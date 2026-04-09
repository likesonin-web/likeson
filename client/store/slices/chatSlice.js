 
import {
  createSlice,
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
} from "@reduxjs/toolkit";
import API   from "../api";
import toast from "react-hot-toast";
import { io } from "socket.io-client";

// ─────────────────────────────────────────────────────────────────────────────
// CALLMANAGER SINGLETON REGISTRY
// (module-level, NOT in Redux state — MediaStream/RTCPeerConnection are not serialisable)
// ─────────────────────────────────────────────────────────────────────────────

let _callManagerInstance = null;

/** Register the CallManager singleton after creating it. */
export function setCallManager(instance) {
  _callManagerInstance = instance;
}

/** Retrieve the CallManager singleton from anywhere (no prop-drilling). */
export function getCallManager() {
  return _callManagerInstance;
}

// ─────────────────────────────────────────────────────────────────────────────
// ENTITY ADAPTERS
// ─────────────────────────────────────────────────────────────────────────────

const conversationsAdapter = createEntityAdapter({
  selectId:     (c) => c._id,
  sortComparer: (a, b) => {
    const aTime = a.lastMessage?.sentAt || a.updatedAt || 0;
    const bTime = b.lastMessage?.sentAt || b.updatedAt || 0;
    return new Date(bTime) - new Date(aTime);
  },
});

const messagesAdapter = createEntityAdapter({
  selectId:     (m) => m._id,
  sortComparer: (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
});

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET SINGLETON
// ─────────────────────────────────────────────────────────────────────────────

let _socket = null;

export function getSocket() { return _socket; }

// ─────────────────────────────────────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function extractError(err) {
  return (
    err?.response?.data?.message ||
    err?.message ||
    "Something went wrong. Please try again."
  );
}

function withGuard(loadingKey) {
  return {
    condition: (_arg, { getState }) => !getState().chat[loadingKey],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — SOCKET
// ─────────────────────────────────────────────────────────────────────────────

/**
 * connectSocket
 * Registers ALL server→client socket events emitted by socket.js.
 *
 * NOTE ON CALL EVENTS:
 * These reducers update ONLY the UI-relevant parts of state (who is calling,
 * call type, status, peer name/avatar, media toggle flags).
 * The actual WebRTC signalling (SDP, ICE) is handled entirely by CallManager.
 * CallManager registers its own socket listeners independently — do NOT remove
 * the call:* events from here; both listeners coexist and handle different concerns.
 */
export const connectSocket = createAsyncThunk(
  "chat/connectSocket",
  async (token, { dispatch, rejectWithValue }) => {
    try {
      if (_socket?.connected) return;

      _socket = io(process.env.NEXT_PUBLIC_SOCKET_URL, {
        auth:                 { token },
        transports:           ["websocket"],
        reconnection:         true,
        reconnectionAttempts: 10,
        reconnectionDelay:    1000,
        timeout:              20000,
      });

      // ── Connection lifecycle ──────────────────────────────────────────────
      _socket.on("connect",       ()  => dispatch(socketConnected()));
      _socket.on("disconnect",    (r) => dispatch(socketDisconnected(r)));
      _socket.on("connect_error", (e) => dispatch(socketError(e.message)));

      // ── Conversation events ───────────────────────────────────────────────
      _socket.on("conversation:created",          (p) => dispatch(_onConversationCreated(p)));
      _socket.on("conversation:updated",          (p) => dispatch(_onConversationUpdated(p)));
      _socket.on("conversation:deleted",          (p) => dispatch(_onConversationDeleted(p)));
      _socket.on("conversation:member_joined",    (p) => dispatch(_onMemberJoined(p)));
      _socket.on("conversation:member_left",      (p) => dispatch(_onMemberLeft(p)));
      _socket.on("conversation:member_added",     (p) => dispatch(_onMemberAdded(p)));
      _socket.on("conversation:member_removed",   (p) => dispatch(_onMemberRemoved(p)));
      _socket.on("conversation:you_were_removed", (p) => dispatch(_onRemovedFromConversation(p)));
      _socket.on("conversation:mute_updated",     (p) => dispatch(_onConversationMuteUpdated(p)));

      // ── Message events ────────────────────────────────────────────────────
      _socket.on("message:new",              (p) => dispatch(_onNewMessage(p)));
      _socket.on("message:edited",           (p) => dispatch(_onMessageEdited(p)));
      _socket.on("message:deleted",          (p) => dispatch(_onMessageDeleted(p)));
      _socket.on("message:reaction",         (p) => dispatch(_onMessageReaction(p)));
      _socket.on("message:pin_updated",      (p) => dispatch(_onMessagePinUpdated(p)));
      _socket.on("message:scheduled",        (p) => dispatch(_onMessageScheduled(p)));
      _socket.on("message:delivery_receipt", (p) => dispatch(_onDeliveryReceipt(p)));
      _socket.on("message:read_receipt",     (p) => dispatch(_onReadReceipt(p)));

      // ── Typing ────────────────────────────────────────────────────────────
      _socket.on("typing:update", (p) => dispatch(_onTypingUpdate(p)));

      // ── Call events ───────────────────────────────────────────────────────
      // Redux slice updates UI state only.
      // CallManager (callEvents.js) handles the WebRTC signalling side.
      // Both listeners are active simultaneously — this is intentional.
      _socket.on("call:incoming",            (p) => dispatch(_onCallIncoming(p)));
      _socket.on("call:ringing",             (p) => dispatch(_onCallRinging(p)));
      // call:offer    — Redux just marks offer arrived; CallManager does setRemoteDescription
      _socket.on("call:offer",               (p) => dispatch(_onCallOffer(p)));
      // call:answered — Redux updates status; CallManager does setRemoteDescription
      _socket.on("call:answered",            (p) => dispatch(_onCallAnswered(p)));
      // call:ice      — Redux is a NO-OP; CallManager._onIce handles addIceCandidate
      _socket.on("call:ice",                 (p) => dispatch(_onCallIce(p)));
      _socket.on("call:media_toggle",        (p) => dispatch(_onCallMediaToggle(p)));
      _socket.on("call:ended",               (p) => dispatch(_onCallEnded(p)));
      _socket.on("call:declined",            (p) => dispatch(_onCallDeclined(p)));
      _socket.on("call:missed",              (p) => dispatch(_onCallMissed(p)));
      _socket.on("call:peer_disconnected",   (p) => dispatch(_onCallPeerDisconnected(p)));
      _socket.on("call:missed_while_offline",(p) => dispatch(_onCallMissedWhileOffline(p)));

      // ── Presence ──────────────────────────────────────────────────────────
      _socket.on("user:online",  (p) => dispatch(_onUserOnline(p)));
      _socket.on("user:offline", (p) => dispatch(_onUserOffline(p)));

      // ── Notifications ─────────────────────────────────────────────────────
      _socket.on("notification:message", (p) => dispatch(_onNotification(p)));
      _socket.on("notification:mention",  (p) => dispatch(_onMention(p)));

    } catch (err) {
      return rejectWithValue(extractError(err));
    }
  }
);

export const disconnectSocket = createAsyncThunk(
  "chat/disconnectSocket",
  async (_, { dispatch }) => {
    // Destroy CallManager before disconnecting socket
    const cm = getCallManager();
    if (cm) {
      cm.destroy();
      setCallManager(null);
    }
    if (_socket) {
      _socket.disconnect();
      _socket = null;
    }
    dispatch(socketDisconnected("manual"));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — CONVERSATIONS
// ─────────────────────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  "chat/fetchConversations",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/chat/conversations", { params });
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  },
  withGuard("loadingConversations")
);

export const fetchConversation = createAsyncThunk(
  "chat/fetchConversation",
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/chat/conversations/${conversationId}`);
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const createConversation = createAsyncThunk(
  "chat/createConversation",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/chat/conversations", payload);
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const createDepartmentChannel = createAsyncThunk(
  "chat/createDepartmentChannel",
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await API.post("/chat/conversations/department", payload);
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchDepartmentChannel = createAsyncThunk(
  "chat/fetchDepartmentChannel",
  async (role, { rejectWithValue }) => {
    try {
      const { data } = await API.get(`/chat/conversations/department/${role}`);
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchPartners = createAsyncThunk(
  "chat/fetchPartners",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/chat/conversations/partners", { params });
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const updateConversation = createAsyncThunk(
  "chat/updateConversation",
  async ({ conversationId, ...updates }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(`/chat/conversations/${conversationId}`, updates);
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const archiveConversation = createAsyncThunk(
  "chat/archiveConversation",
  async ({ conversationId, archive }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/archive`,
        { archive }
      );
      return { conversationId, archive, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const muteConversation = createAsyncThunk(
  "chat/muteConversation",
  async ({ conversationId, mute, mutedUntil }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/mute`,
        { mute, mutedUntil }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const addMembers = createAsyncThunk(
  "chat/addMembers",
  async ({ conversationId, userIds }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/members`,
        { userIds }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const removeMember = createAsyncThunk(
  "chat/removeMember",
  async ({ conversationId, userId }, { rejectWithValue }) => {
    try {
      await API.delete(`/chat/conversations/${conversationId}/members/${userId}`);
      return { conversationId, userId };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const leaveConversation = createAsyncThunk(
  "chat/leaveConversation",
  async (conversationId, { rejectWithValue }) => {
    try {
      await API.post(`/chat/conversations/${conversationId}/leave`);
      return conversationId;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const promoteMember = createAsyncThunk(
  "chat/promoteMember",
  async ({ conversationId, userId, promote }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/promote/${userId}`,
        { promote }
      );
      return { conversationId, promote, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const deleteConversation = createAsyncThunk(
  "chat/deleteConversation",
  async (conversationId, { rejectWithValue }) => {
    try {
      await API.delete(`/chat/conversations/${conversationId}`);
      return conversationId;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export const fetchMessages = createAsyncThunk(
  "chat/fetchMessages",
  async ({ conversationId, params = {} }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages`,
        { params }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchMoreMessages = createAsyncThunk(
  "chat/fetchMoreMessages",
  async ({ conversationId, before }, { getState, rejectWithValue }) => {
    if (getState().chat.loadingMoreMessages) return rejectWithValue("Already loading");
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages`,
        { params: { before, limit: 30 } }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const sendMessage = createAsyncThunk(
  "chat/sendMessage",
  async ({ conversationId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages`,
        payload
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const sendStickerMessage = createAsyncThunk(
  "chat/sendStickerMessage",
  async ({ conversationId, sticker, replyTo }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages`,
        { type: "sticker", sticker, replyTo: replyTo || undefined }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const sendMediaMessage = createAsyncThunk(
  "chat/sendMediaMessage",
  async ({ conversationId, formData, onUploadProgress }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages/media`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const sendMultipleMedia = createAsyncThunk(
  "chat/sendMultipleMedia",
  async ({ conversationId, formData, onUploadProgress }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages/media/multiple`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const sendRecordingMessage = createAsyncThunk(
  "chat/sendRecordingMessage",
  async ({ conversationId, formData, onUploadProgress }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages/recording`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" }, onUploadProgress }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const editMessage = createAsyncThunk(
  "chat/editMessage",
  async ({ conversationId, messageId, content }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/messages/${messageId}`,
        { content }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const deleteMessage = createAsyncThunk(
  "chat/deleteMessage",
  async ({ conversationId, messageId, scope }, { rejectWithValue }) => {
    try {
      await API.delete(
        `/chat/conversations/${conversationId}/messages/${messageId}`,
        { data: { scope } }
      );
      return { conversationId, messageId, scope };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const reactToMessage = createAsyncThunk(
  "chat/reactToMessage",
  async ({ conversationId, messageId, emoji }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages/${messageId}/react`,
        { emoji }
      );
      return { conversationId, messageId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const pinMessage = createAsyncThunk(
  "chat/pinMessage",
  async ({ conversationId, messageId, pin }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/messages/${messageId}/pin`,
        { pin }
      );
      return { conversationId, messageId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchPinnedMessages = createAsyncThunk(
  "chat/fetchPinnedMessages",
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages/pinned`
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const forwardMessage = createAsyncThunk(
  "chat/forwardMessage",
  async ({ conversationId, messageId, targetConversationIds }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/messages/${messageId}/forward`,
        { targetConversationIds }
      );
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const markMessageRead = createAsyncThunk(
  "chat/markMessageRead",
  async ({ conversationId, messageId }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/messages/${messageId}/read`
      );
      return { conversationId, messageId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const markMessageDelivered = createAsyncThunk(
  "chat/markMessageDelivered",
  async ({ conversationId, messageId }, { rejectWithValue }) => {
    try {
      await API.patch(
        `/chat/conversations/${conversationId}/messages/${messageId}/delivered`
      );
      return { conversationId, messageId };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const markAllRead = createAsyncThunk(
  "chat/markAllRead",
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/read-all`
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const searchMessages = createAsyncThunk(
  "chat/searchMessages",
  async ({ conversationId, q, page }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages/search`,
        { params: { q, page } }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchMediaMessages = createAsyncThunk(
  "chat/fetchMediaMessages",
  async ({ conversationId, type, page }, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages/media`,
        { params: { type, page } }
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchScheduledMessages = createAsyncThunk(
  "chat/fetchScheduledMessages",
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/messages/scheduled`
      );
      return { conversationId, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const cancelScheduledMessage = createAsyncThunk(
  "chat/cancelScheduledMessage",
  async ({ conversationId, messageId }, { rejectWithValue }) => {
    try {
      await API.delete(
        `/chat/conversations/${conversationId}/messages/scheduled/${messageId}`
      );
      return { conversationId, messageId };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — CALLS (REST)
// These hit the REST API to create/update the call Message document in MongoDB.
// They do NOT initiate WebRTC signalling — use CallManager for that.
// ─────────────────────────────────────────────────────────────────────────────

export const initiateCall = createAsyncThunk(
  "chat/initiateCall",
  async ({ conversationId, callType, mediaConstraints }, { rejectWithValue }) => {
    try {
      const { data } = await API.post(
        `/chat/conversations/${conversationId}/call/initiate`,
        {
          callType,
          mediaConstraints: mediaConstraints || {
            audio: true,
            video: callType === "video",
          },
        }
      );
      return { conversationId, callType, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const endCall = createAsyncThunk(
  "chat/endCall",
  async ({ conversationId, messageId, duration }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/call/${messageId}/end`,
        { duration }
      );
      return { conversationId, messageId, duration, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const updateCallStatus = createAsyncThunk(
  "chat/updateCallStatus",
  async ({ conversationId, messageId, status }, { rejectWithValue }) => {
    try {
      const { data } = await API.patch(
        `/chat/conversations/${conversationId}/call/${messageId}/status`,
        { status }
      );
      return { conversationId, messageId, status, ...data };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — PRESENCE & UNREAD
// ─────────────────────────────────────────────────────────────────────────────

export const fetchOnlinePresence = createAsyncThunk(
  "chat/fetchOnlinePresence",
  async (userIds, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/chat/users/online", {
        params: { userIds: userIds.join(",") },
      });
      return data.presence;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchTotalUnreadCount = createAsyncThunk(
  "chat/fetchTotalUnreadCount",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/chat/unread/count");
      return data.unreadCount;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const fetchConversationUnreadCount = createAsyncThunk(
  "chat/fetchConversationUnreadCount",
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await API.get(
        `/chat/conversations/${conversationId}/unread/count`
      );
      return { conversationId, unreadCount: data.unreadCount };
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — ADMIN
// ─────────────────────────────────────────────────────────────────────────────

export const adminFetchConversations = createAsyncThunk(
  "chat/adminFetchConversations",
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await API.get("/chat/admin/conversations", { params });
      return data;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

export const adminDeleteMessage = createAsyncThunk(
  "chat/adminDeleteMessage",
  async (messageId, { rejectWithValue }) => {
    try {
      await API.delete(`/chat/admin/messages/${messageId}`);
      return messageId;
    } catch (err) { return rejectWithValue(extractError(err)); }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EMIT THUNKS — MESSAGES
// ─────────────────────────────────────────────────────────────────────────────

export const socketSendMessage = createAsyncThunk(
  "chat/socketSendMessage",
  async (payload, { rejectWithValue }) =>
    new Promise((resolve, reject) => {
      if (!_socket?.connected) return reject("Socket not connected");
      _socket.emit("message:send", payload, (ack) => {
        if (ack?.success) resolve(ack);
        else reject(ack?.message || "Failed to send message");
      });
    }).catch((err) => rejectWithValue(err))
);

export const socketUploadRecording = createAsyncThunk(
  "chat/socketUploadRecording",
  async (payload, { rejectWithValue }) =>
    new Promise((resolve, reject) => {
      if (!_socket?.connected) return reject("Socket not connected");
      _socket.emit("call:recording_upload", payload, (ack) => {
        if (ack?.success) resolve(ack);
        else reject(ack?.message || "Recording upload failed");
      });
    }).catch((err) => rejectWithValue(err))
);

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EMIT HELPERS — CALLS
//
// These are thin fire-and-forget wrappers for components that hold a reference
// to the store but NOT to the CallManager instance.
//
// IMPORTANT: Do NOT use socketCallOffer / socketCallAnswer / socketCallIce
// manually — CallManager handles those internally. Only use the ones below.
// ─────────────────────────────────────────────────────────────────────────────

/** Notify caller that this device is ringing (callee side).
 *  Normally called by CallManager.acceptCall() — only use this if you are
 *  building a custom flow without CallManager. */
export const socketCallRinging = (payload) => () => {
  // payload: { conversationId, targetUserId (caller's _id) }
  _socket?.emit("call:ringing", payload);
};

/** End the call (notifies peers + updates DB duration).
 *  Prefer callManager.endCall() — this is a low-level escape hatch. */
export const socketCallEnd = (payload) => () => {
  // payload: { conversationId, messageId, duration }
  _socket?.emit("call:end", payload);
};

/** Decline an incoming call.
 *  Prefer callManager.declineCall(incomingPayload) — same caveat. */
export const socketCallDecline = (payload) => () => {
  // payload: { conversationId, messageId }
  _socket?.emit("call:decline", payload);
};

/** Mark call as missed. */
export const socketCallMissed = (payload) => () => {
  // payload: { conversationId, messageId }
  _socket?.emit("call:missed", payload);
};

/** Notify peers about audio/video mute toggle.
 *  Prefer callManager.toggleAudio/toggleVideo() — same caveat. */
export const socketCallMediaToggle = (payload) => () => {
  // payload: { conversationId, kind: 'audio'|'video', enabled: bool }
  _socket?.emit("call:media_toggle", payload);
};

// ── Typing ────────────────────────────────────────────────────────────────────
export const socketTypingStart = (conversationId) => () => {
  _socket?.emit("typing:start", { conversationId });
};

export const socketTypingStop = (conversationId) => () => {
  _socket?.emit("typing:stop", { conversationId });
};

/** Query presence for a list of userIds */
export const socketPresenceGet = (userIds) => (dispatch) => {
  if (!_socket?.connected) return;
  _socket.emit("presence:get", { userIds }, (result) => {
    dispatch(_setPresenceBatch(result));
  });
};

// ─────────────────────────────────────────────────────────────────────────────
// INITIAL STATE
// ─────────────────────────────────────────────────────────────────────────────

const initialState = {
  // ── Conversations ──────────────────────────────────────────────────────────
  ...conversationsAdapter.getInitialState(),
  conversationPagination: { page: 1, limit: 30, total: 0, pages: 0 },
  loadingConversations:   false,
  loadingConversation:    false,

  // ── Active conversation ────────────────────────────────────────────────────
  activeConversationId: null,

  // ── Messages (keyed by conversationId → EntityState) ──────────────────────
  messages:             {},
  messagePagination:    {},
  loadingMessages:      false,
  loadingMoreMessages:  false,
  sendingMessage:       false,
  uploadProgress:       0,

  // ── Recording upload ───────────────────────────────────────────────────────
  sendingRecording:     false,
  recordingProgress:    0,

  // ── Pinned / scheduled / media ────────────────────────────────────────────
  pinnedMessages:       {},
  scheduledMessages:    {},
  mediaMessages:        {},

  // ── Search ────────────────────────────────────────────────────────────────
  searchResults:        [],
  searchLoading:        false,
  searchQuery:          "",

  // ── Typing ────────────────────────────────────────────────────────────────
  typing:               {},

  // ── Presence ──────────────────────────────────────────────────────────────
  presence:             {},

  // ── Unread ────────────────────────────────────────────────────────────────
  totalUnreadCount:     0,
  unreadCounts:         {},

  // ── Partners ──────────────────────────────────────────────────────────────
  partners:             [],
  partnerPagination:    { page: 1, total: 0, pages: 0 },
  loadingPartners:      false,

  // ── Department channel ────────────────────────────────────────────────────
  departmentChannel:    null,

  /**
   * activeCall — UI-only call state.
   * Does NOT contain SDP or ICE candidates (CallManager owns those).
   *
   * Shape:
   * {
   *   conversationId: string,
   *   callType:       'audio' | 'video',
   *   messageId:      string,          — DB Message _id for call log
   *   status:         'calling' | 'ringing' | 'connecting' | 'connected' | 'ended',
   *   targetUserId:   string,          — peer's userId (NEW — was missing)
   *   mediaConstraints: { audio: bool, video: bool },
   *   caller:         UserObject | null,
   *   callee:         UserObject | null,
   *   callRinging:    bool,            — true once callee confirmed ringing
   *   peerMedia:      { audio: bool, video: bool },   — peer's mute/video state
   *   peerDisconnected: { userId, userName } | null,
   * }
   *
   * REMOVED vs original:
   *   iceCandidates  — managed by CallManager._iceCandidateQueue
   *   peerSdpOffer   — managed by CallManager (setRemoteDescription)
   *   peerSdpAnswer  — managed by CallManager (setRemoteDescription)
   */
  activeCall:           null,

  /**
   * incomingCall — payload of the most recent call:incoming event.
   * Shape:
   * {
   *   conversationId:   string,
   *   callType:         'audio' | 'video',
   *   caller:           { _id, name, avatar, role },
   *   messageId:        string,
   *   mediaConstraints: { audio: bool, video: bool },
   *   delayed:          bool,
   * }
   *
   * REMOVED vs original:
   *   peerSdpOffer  — passed directly to CallManager.acceptCall(), not stored in Redux
   *   fromUserId    — use incomingCall.caller._id instead
   */
  incomingCall:         null,

  // ── Socket ────────────────────────────────────────────────────────────────
  socketConnected:      false,
  socketError:          null,
  socketReconnecting:   false,

  // ── Admin ─────────────────────────────────────────────────────────────────
  adminConversations:   [],
  adminPagination:      { page: 1, total: 0, pages: 0 },
  adminLoading:         false,

  // ── Global ────────────────────────────────────────────────────────────────
  error:                null,
  success:              null,
};

// ─────────────────────────────────────────────────────────────────────────────
// PER-CONVERSATION MESSAGE ADAPTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getOrInitMsgState(state, conversationId) {
  if (!state.messages[conversationId]) {
    state.messages[conversationId] = messagesAdapter.getInitialState();
  }
  return state.messages[conversationId];
}

function upsertMsg(state, conversationId, message) {
  messagesAdapter.upsertOne(getOrInitMsgState(state, conversationId), message);
}

function upsertMsgs(state, conversationId, messages) {
  messagesAdapter.upsertMany(getOrInitMsgState(state, conversationId), messages);
}

function findConvIdForMessage(state, messageId) {
  for (const convId of Object.keys(state.messages)) {
    if (state.messages[convId]?.entities[messageId]) return convId;
  }
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: "chat",
  initialState,

  reducers: {

    // ── Socket lifecycle ──────────────────────────────────────────────────────
    socketConnected(state) {
      state.socketConnected    = true;
      state.socketError        = null;
      state.socketReconnecting = false;
    },
    socketDisconnected(state, { payload: reason }) {
      state.socketConnected    = false;
      state.socketReconnecting = reason !== "manual";
    },
    socketError(state, { payload }) {
      state.socketError     = payload;
      state.socketConnected = false;
    },

    // ── Active conversation ───────────────────────────────────────────────────
    setActiveConversation(state, { payload }) {
      state.activeConversationId = payload;
      if (payload) {
        const prev = state.unreadCounts[payload] || 0;
        state.totalUnreadCount      = Math.max(0, state.totalUnreadCount - prev);
        state.unreadCounts[payload] = 0;
      }
    },
    clearActiveConversation(state) {
      state.activeConversationId = null;
    },

    // ── Conversation socket events ────────────────────────────────────────────

    _onConversationCreated(state, { payload }) {
      const { conversation } = payload;
      if (conversation) conversationsAdapter.upsertOne(state, conversation);
    },

    _onConversationUpdated(state, { payload }) {
      const { conversationId, updates } = payload;
      if (conversationId && updates) {
        conversationsAdapter.updateOne(state, { id: conversationId, changes: updates });
      }
    },

    _onConversationDeleted(state, { payload }) {
      const { conversationId } = payload;
      if (!conversationId) return;
      conversationsAdapter.removeOne(state, conversationId);
      if (state.messages[conversationId]) delete state.messages[conversationId];
      if (state.activeConversationId === conversationId) state.activeConversationId = null;
    },

    _onConversationMuteUpdated(state, { payload }) {
      const { conversationId, isMuted, mutedUntil, userId } = payload;
      const conv = state.entities[conversationId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      conversationId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === userId?.toString()
              ? { ...p, isMuted, mutedUntil }
              : p
          ),
        },
      });
    },

    _onMemberJoined(state, { payload }) {
      const { conversationId, user } = payload;
      const conv = state.entities[conversationId];
      if (!conv || !user) return;
      const exists = conv.participants?.find(
        (p) => (p.user?._id || p.user)?.toString() === user._id?.toString()
      );
      if (!exists) {
        conversationsAdapter.updateOne(state, {
          id:      conversationId,
          changes: {
            participants: [
              ...(conv.participants || []),
              { user, isActive: true, joinedAt: new Date().toISOString(), conversationRole: "member" },
            ],
          },
        });
      }
    },

    _onMemberLeft(state, { payload }) {
      const { conversationId, userId } = payload;
      const conv = state.entities[conversationId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      conversationId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === userId?.toString()
              ? { ...p, isActive: false, leftAt: new Date().toISOString() }
              : p
          ),
        },
      });
    },

    _onMemberAdded(state, { payload }) {
      const { conversationId, addedUser } = payload;
      const conv = state.entities[conversationId];
      if (!conv || !addedUser) return;
      const exists = conv.participants?.find(
        (p) => (p.user?._id || p.user)?.toString() === addedUser._id?.toString()
      );
      if (!exists) {
        conversationsAdapter.updateOne(state, {
          id:      conversationId,
          changes: {
            participants: [
              ...(conv.participants || []),
              { user: addedUser, isActive: true, conversationRole: "member" },
            ],
          },
        });
      }
    },

    _onMemberRemoved(state, { payload }) {
      const { conversationId, targetUserId } = payload;
      const conv = state.entities[conversationId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      conversationId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === targetUserId?.toString()
              ? { ...p, isActive: false }
              : p
          ),
        },
      });
    },

    _onRemovedFromConversation(state, { payload }) {
      const { conversationId } = payload;
      conversationsAdapter.removeOne(state, conversationId);
      if (state.messages[conversationId]) delete state.messages[conversationId];
      if (state.activeConversationId === conversationId) state.activeConversationId = null;
      toast("You were removed from a conversation.", { icon: "ℹ️" });
    },

    // ── Message socket events ─────────────────────────────────────────────────

    _onNewMessage(state, { payload }) {
      const { message } = payload;
      if (!message) return;
      const convId = message.conversation?._id || message.conversation;

      upsertMsg(state, convId, message);

      const preview =
        message.type === "sticker"
          ? message.sticker?.title || "🎭 Sticker"
          : (message.content || "").slice(0, 100);

      conversationsAdapter.updateOne(state, {
        id:      convId,
        changes: {
          lastMessage: {
            messageId: message._id,
            senderId:  message.sender?._id || message.sender,
            content:   preview,
            type:      message.type,
            sentAt:    message.createdAt,
          },
        },
      });

      if (state.activeConversationId !== convId) {
        state.unreadCounts[convId] = (state.unreadCounts[convId] || 0) + 1;
        state.totalUnreadCount     = Math.max(0, state.totalUnreadCount + 1);
      }
    },

    _onMessageEdited(state, { payload }) {
      const { messageId, content, editedAt, editHistory } = payload;
      const convId = findConvIdForMessage(state, messageId);
      if (!convId) return;
      messagesAdapter.updateOne(state.messages[convId], {
        id: messageId, changes: { content, isEdited: true, editedAt, editHistory },
      });
    },

    _onMessageDeleted(state, { payload }) {
      const { messageId, scope, deletedBy, deletedAt } = payload;
      const convId = findConvIdForMessage(state, messageId);
      if (!convId) return;
      messagesAdapter.updateOne(state.messages[convId], {
        id:      messageId,
        changes: {
          isDeleted:   true,
          deleteScope: scope,
          deletedAt,
          deletedBy,
          ...(scope === "deleted_for_everyone" ? { content: "", attachments: [] } : {}),
        },
      });
    },

    _onMessageReaction(state, { payload }) {
      const { messageId, reactions } = payload;
      const convId = findConvIdForMessage(state, messageId);
      if (!convId) return;
      messagesAdapter.updateOne(state.messages[convId], {
        id: messageId, changes: { reactions },
      });
    },

    _onMessagePinUpdated(state, { payload }) {
      const { messageId, isPinned, pinnedAt, pinnedBy } = payload;
      const convId = findConvIdForMessage(state, messageId);
      if (!convId) return;
      messagesAdapter.updateOne(state.messages[convId], {
        id: messageId, changes: { isPinned, pinnedAt, pinnedBy },
      });
    },

    _onMessageScheduled(state, { payload }) {
      const { message } = payload;
      if (!message) return;
      const convId = message.conversation?._id || message.conversation;
      if (!state.scheduledMessages[convId]) state.scheduledMessages[convId] = [];
      const idx = state.scheduledMessages[convId].findIndex((m) => m._id === message._id);
      if (idx >= 0) state.scheduledMessages[convId][idx] = message;
      else state.scheduledMessages[convId].push(message);
    },

    _onDeliveryReceipt(state, { payload }) {
      const { messageId, userId, deliveredAt } = payload;
      const convId = findConvIdForMessage(state, messageId);
      if (!convId) return;
      const msg = state.messages[convId]?.entities[messageId];
      if (!msg) return;
      messagesAdapter.updateOne(state.messages[convId], {
        id:      messageId,
        changes: {
          receipts: (msg.receipts || []).map((r) =>
            (r.user?._id || r.user)?.toString() === userId?.toString()
              ? { ...r, deliveredAt }
              : r
          ),
        },
      });
    },

    _onReadReceipt(state, { payload }) {
      const { conversationId, messageId, readBy, readAt } = payload;
      const msgState = state.messages[conversationId];
      if (!msgState) return;
      const pivotIdx = msgState.ids.indexOf(messageId);
      if (pivotIdx < 0) return;
      for (const mid of msgState.ids.slice(0, pivotIdx + 1)) {
        const msg = msgState.entities[mid];
        if (!msg) continue;
        messagesAdapter.updateOne(msgState, {
          id:      mid,
          changes: {
            receipts: (msg.receipts || []).map((r) =>
              (r.user?._id || r.user)?.toString() === readBy?.toString()
                ? { ...r, readAt: r.readAt || readAt }
                : r
            ),
          },
        });
      }
    },

    // ── Typing ────────────────────────────────────────────────────────────────

    _onTypingUpdate(state, { payload }) {
      const { conversationId, userId, name, isTyping } = payload;
      if (!state.typing[conversationId]) state.typing[conversationId] = {};
      if (isTyping) {
        state.typing[conversationId][userId] = { name, isTyping: true };
      } else {
        delete state.typing[conversationId][userId];
      }
    },

    // ── Presence ──────────────────────────────────────────────────────────────

    _onUserOnline(state, { payload }) {
      state.presence[payload.userId] = {
        isOnline: true,
        name:     payload.name,
        avatar:   payload.avatar,
        role:     payload.role,
      };
    },
    _onUserOffline(state, { payload }) {
      state.presence[payload.userId] = { isOnline: false, lastseen: payload.lastseen };
    },
    _setPresenceBatch(state, { payload }) {
      for (const [userId, data] of Object.entries(payload || {})) {
        state.presence[userId] = data;
      }
    },

    // ── Call socket events ────────────────────────────────────────────────────
    //
    // DESIGN PRINCIPLE:
    // Redux only stores what the UI needs to render.
    // CallManager (callEvents.js) owns all WebRTC state (SDP, ICE, streams).
    // Both work simultaneously on the same socket events without conflict.

    /**
     * call:incoming — received by callee.
     * Stores display info for the incoming call modal.
     * CallManager._onIncoming handles the WebRTC preparation in parallel.
     */
    _onCallIncoming(state, { payload }) {
      // Don't overwrite an active call's state if already in a call
      if (state.activeCall) return;

      state.incomingCall = {
        conversationId:   payload.conversationId,
        callType:         payload.callType,
        caller:           payload.caller,
        messageId:        payload.messageId,
        mediaConstraints: payload.mediaConstraints || {
          audio: true,
          video: payload.callType === "video",
        },
        delayed: payload.delayed || false,
        // NOTE: peerSdpOffer is NOT stored here — CallManager handles it
      };

      toast(
        `📞 Incoming ${payload.callType} call from ${payload.caller?.name}`,
        { duration: 30000, id: "incoming-call" }
      );
    },

    /**
     * call:ringing — received by CALLER when callee's device starts ringing.
     * socket.js emits: { conversationId, from, user: { _id, name, avatar } }
     *
     * FIXED: Removed the attempt to call _createAndSendOffer() from here.
     * CallManager._onRinging() already handles that internally.
     * Redux just updates UI status.
     */
    _onCallRinging(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status      = "ringing";
      state.activeCall.callRinging = true;
      state.activeCall.callee      = payload.user || null;
    },

    /**
     * call:offer — received by CALLEE; contains SDP offer from caller.
     * socket.js emits: { conversationId, sdp, from, mediaConstraints, caller }
     *
     * FIXED: Redux does NOT store sdp here anymore.
     * CallManager._onOffer() calls setRemoteDescription + createAnswer directly.
     * Redux only updates connection status for the UI.
     */
    _onCallOffer(state, { payload }) {
      // Update activeCall status if callee has already accepted
      if (state.activeCall) {
        state.activeCall.status = "connecting";
        // Update targetUserId with the caller's id from the offer
        if (payload.from && !state.activeCall.targetUserId) {
          state.activeCall.targetUserId = payload.from;
        }
      }
      // Update incomingCall caller info if present (for delayed calls)
      if (state.incomingCall && payload.caller) {
        state.incomingCall.caller = payload.caller;
      }
    },

    /**
     * call:answered — received by CALLER after callee sends SDP answer.
     * socket.js emits: { conversationId, sdp, from, callee }
     *
     * FIXED: Redux does NOT store sdp here anymore.
     * CallManager._onAnswered() calls setRemoteDescription directly.
     * Redux only updates call status + callee info.
     */
    _onCallAnswered(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status = "connecting";
      state.activeCall.callee = payload.callee || null;
      if (payload.from && !state.activeCall.targetUserId) {
        state.activeCall.targetUserId = payload.from;
      }
      toast.dismiss("incoming-call");
    },

    /**
     * call:ice — received by either peer.
     * socket.js emits: { conversationId, candidate, from }
     *
     * FIXED: This is now intentionally a NO-OP in Redux.
     * CallManager._onIce() calls pc.addIceCandidate() directly — no Redux
     * involvement needed. Storing ICE candidates in Redux caused a critical
     * bug: components would try to apply stale candidates after the
     * RTCPeerConnection had already processed them via CallManager.
     */
    // eslint-disable-next-line no-unused-vars
    _onCallIce(_state, _action) {
      // Intentional NO-OP — CallManager handles ICE internally
    },

    /**
     * call:media_toggle — peer muted/unmuted audio or video.
     * socket.js emits: { conversationId, kind, enabled, from }
     * This drives the "peer is muted" indicator in the call UI.
     */
    _onCallMediaToggle(state, { payload }) {
      if (!state.activeCall) return;
      if (!state.activeCall.peerMedia) {
        state.activeCall.peerMedia = { audio: true, video: true };
      }
      if (payload.kind === "audio" || payload.kind === "video") {
        state.activeCall.peerMedia[payload.kind] = payload.enabled;
      }
    },

    /**
     * call:ended — remote party ended the call.
     * socket.js emits: { conversationId, endedBy, duration, endedByUser }
     */
    _onCallEnded(state, { payload }) {
      state.activeCall   = null;
      state.incomingCall = null;
      toast.dismiss("incoming-call");
      if (payload?.duration) {
        const mins = Math.floor(payload.duration / 60);
        const secs = payload.duration % 60;
        toast(`Call ended — ${mins}m ${secs}s`, { icon: "📞" });
      } else {
        toast("Call ended.", { icon: "📞" });
      }
    },

    /**
     * call:declined — callee rejected our call.
     * socket.js emits: { conversationId, declinedBy, declinedByUser }
     */
    _onCallDeclined(state, { payload }) {
      state.activeCall   = null;
      state.incomingCall = null;
      toast.dismiss("incoming-call");
      const name = payload?.declinedByUser?.name;
      toast(name ? `${name} declined the call` : "Call declined.", { icon: "📵" });
    },

    /**
     * call:missed — call timed out with no answer.
     * socket.js emits: { conversationId, userId }
     */
    _onCallMissed(state) {
      state.activeCall   = null;
      state.incomingCall = null;
      toast.dismiss("incoming-call");
      toast("Missed call", { icon: "📵" });
    },

    /**
     * call:peer_disconnected — socket disconnected mid-call.
     * socket.js emits: { conversationId, userId, userName }
     */
    _onCallPeerDisconnected(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status          = "reconnecting";
      state.activeCall.peerDisconnected = {
        userId:   payload.userId,
        userName: payload.userName,
      };
    },

    /**
     * call:missed_while_offline — delivered on reconnect.
     * payload: { conversationId, callType, caller, messageId }
     */
    _onCallMissedWhileOffline(state, { payload }) {
      void state;
      toast(
        `📵 Missed ${payload.callType || ""} call from ${payload.caller?.name || "someone"} while offline`,
        { duration: 8000 }
      );
    },

    /**
     * setActiveCall — called by components after CallManager.initiateCall()
     * or CallManager.acceptCall() succeeds.
     *
     * Shape of payload:
     * {
     *   conversationId: string,   REQUIRED
     *   callType:       'audio'|'video',  REQUIRED
     *   messageId:      string,   REQUIRED — DB Message _id
     *   status:         string,   default: 'calling'
     *   targetUserId:   string,   REQUIRED — peer's userId (NEW FIELD)
     *   caller:         UserObject | null,
     *   callee:         UserObject | null,
     *   mediaConstraints: { audio: bool, video: bool },
     * }
     *
     * NOTE: Do NOT include iceCandidates / peerSdpOffer / peerSdpAnswer.
     * Those are managed by CallManager.
     */
    setActiveCall(state, { payload }) {
      state.activeCall = {
        status:           "calling",
        mediaConstraints: { audio: true, video: payload.callType === "video" },
        caller:           null,
        callee:           null,
        callRinging:      false,
        peerMedia:        { audio: true, video: true },
        peerDisconnected: null,
        // Spread the provided payload — any of the above defaults are overridden
        ...payload,
        // Guarantee these never appear in Redux state (non-serialisable / CallManager-owned)
        iceCandidates:  undefined,
        peerSdpOffer:   undefined,
        peerSdpAnswer:  undefined,
      };
      state.incomingCall = null;
      toast.dismiss("incoming-call");
    },

    clearIncomingCall(state) {
      state.incomingCall = null;
      toast.dismiss("incoming-call");
    },

    clearActiveCall(state) {
      state.activeCall = null;
    },

    // ── Notifications ─────────────────────────────────────────────────────────
    _onNotification(state, { payload }) { void state; void payload; },
    _onMention(state, { payload }) {
      toast(`You were mentioned by ${payload.mentionedBy?.name}`, { icon: "🔔" });
    },

    // ── Upload helpers ────────────────────────────────────────────────────────
    setUploadProgress(state, { payload })   { state.uploadProgress   = payload; },
    resetUploadProgress(state)              { state.uploadProgress   = 0; },
    setRecordingProgress(state, { payload }){ state.recordingProgress = payload; },
    resetRecordingProgress(state)           { state.recordingProgress = 0; },

    // ── Misc ──────────────────────────────────────────────────────────────────
    clearSearchResults(state) { state.searchResults = []; state.searchQuery = ""; },
    clearError(state)         { state.error   = null; },
    clearSuccess(state)       { state.success = null; },
    resetChatState()          { return initialState; },
  },

  // ─────────────────────────────────────────────────────────────────────────
  // EXTRA REDUCERS
  // ─────────────────────────────────────────────────────────────────────────
  extraReducers: (builder) => {

    builder.addCase(connectSocket.rejected, (state, { payload }) => {
      state.socketError = payload;
      toast.error("Chat connection failed");
    });

    // ── fetchConversations ───────────────────────────────────────────────────
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.loadingConversations = true; state.error = null;
      })
      .addCase(fetchConversations.fulfilled, (state, { payload }) => {
        state.loadingConversations = false;
        conversationsAdapter.setAll(state, payload.conversations || []);
        state.conversationPagination = payload.pagination || state.conversationPagination;
        for (const c of payload.conversations || []) {
          if (c.unreadCount !== undefined) state.unreadCounts[c._id] = c.unreadCount;
        }
      })
      .addCase(fetchConversations.rejected, (state, { payload }) => {
        state.loadingConversations = false; state.error = payload;
      });

    builder
      .addCase(fetchConversation.pending,   (state) => { state.loadingConversation = true; })
      .addCase(fetchConversation.fulfilled, (state, { payload }) => {
        state.loadingConversation = false;
        if (payload.conversation) conversationsAdapter.upsertOne(state, payload.conversation);
      })
      .addCase(fetchConversation.rejected,  (state, { payload }) => {
        state.loadingConversation = false; state.error = payload;
      });

    builder
      .addCase(createConversation.fulfilled, (state, { payload }) => {
        if (payload.conversation) conversationsAdapter.upsertOne(state, payload.conversation);
        if (!payload.alreadyExists) toast.success("Conversation created");
      })
      .addCase(createConversation.rejected, (state, { payload }) => {
        state.error = payload; toast.error(payload || "Failed to create conversation");
      });

    builder
      .addCase(createDepartmentChannel.fulfilled, (state, { payload }) => {
        if (payload.conversation) {
          conversationsAdapter.upsertOne(state, payload.conversation);
          state.departmentChannel = payload.conversation;
        }
        toast.success(`Department channel created (${payload.memberCount} members)`);
      })
      .addCase(createDepartmentChannel.rejected, (state, { payload }) => {
        state.error = payload; toast.error(payload || "Failed to create department channel");
      });

    builder
      .addCase(fetchDepartmentChannel.fulfilled, (state, { payload }) => {
        if (payload.conversation) {
          state.departmentChannel = payload.conversation;
          conversationsAdapter.upsertOne(state, payload.conversation);
        }
      })
      .addCase(fetchDepartmentChannel.rejected, (state, { payload }) => { state.error = payload; });

    builder
      .addCase(fetchPartners.pending,   (state) => { state.loadingPartners = true; })
      .addCase(fetchPartners.fulfilled, (state, { payload }) => {
        state.loadingPartners   = false;
        state.partners          = payload.users || [];
        state.partnerPagination = payload.pagination || state.partnerPagination;
      })
      .addCase(fetchPartners.rejected,  (state, { payload }) => {
        state.loadingPartners = false; state.error = payload;
      });

    builder
      .addCase(updateConversation.fulfilled, (state, { payload }) => {
        if (payload.conversation) conversationsAdapter.upsertOne(state, payload.conversation);
        toast.success("Conversation updated");
      })
      .addCase(updateConversation.rejected, (state, { payload }) => {
        state.error = payload; toast.error(payload || "Update failed");
      });

    builder
      .addCase(archiveConversation.fulfilled, (state, { payload }) => {
        conversationsAdapter.updateOne(state, {
          id: payload.conversationId, changes: { isArchived: payload.archive },
        });
        toast.success(payload.archive ? "Conversation archived" : "Conversation unarchived");
      })
      .addCase(archiveConversation.rejected, (_, { payload }) => {
        toast.error(payload || "Action failed");
      });

    builder
      .addCase(muteConversation.fulfilled, (_, { payload }) => {
        toast.success(payload.muted ? "Conversation muted" : "Conversation unmuted");
      })
      .addCase(muteConversation.rejected, (_, { payload }) => {
        toast.error(payload || "Mute failed");
      });

    builder
      .addCase(addMembers.fulfilled, (_, { payload }) => {
        toast.success(`${payload.added?.length || 0} member(s) added`);
      })
      .addCase(addMembers.rejected, (_, { payload }) => {
        toast.error(payload || "Failed to add members");
      });

    builder
      .addCase(removeMember.fulfilled, (state, { payload }) => {
        const conv = state.entities[payload.conversationId];
        if (conv) {
          conversationsAdapter.updateOne(state, {
            id:      payload.conversationId,
            changes: {
              participants: conv.participants?.map((p) =>
                (p.user?._id || p.user)?.toString() === payload.userId?.toString()
                  ? { ...p, isActive: false }
                  : p
              ),
            },
          });
        }
        toast.success("Member removed");
      })
      .addCase(removeMember.rejected, (_, { payload }) => {
        toast.error(payload || "Failed to remove member");
      });

    builder
      .addCase(leaveConversation.fulfilled, (state, { payload: convId }) => {
        conversationsAdapter.removeOne(state, convId);
        if (state.messages[convId]) delete state.messages[convId];
        if (state.activeConversationId === convId) state.activeConversationId = null;
        toast.success("Left conversation");
      })
      .addCase(leaveConversation.rejected, (_, { payload }) => {
        toast.error(payload || "Failed to leave conversation");
      });

    builder
      .addCase(promoteMember.fulfilled, (_, { payload }) => {
        toast.success(payload.role === "admin" ? "Member promoted to admin" : "Member demoted");
      })
      .addCase(promoteMember.rejected, (_, { payload }) => {
        toast.error(payload || "Promotion failed");
      });

    builder
      .addCase(deleteConversation.fulfilled, (state, { payload: convId }) => {
        conversationsAdapter.removeOne(state, convId);
        if (state.messages[convId]) delete state.messages[convId];
        if (state.activeConversationId === convId) state.activeConversationId = null;
        toast.success("Conversation deleted");
      })
      .addCase(deleteConversation.rejected, (_, { payload }) => {
        toast.error(payload || "Delete failed");
      });

    // ── fetchMessages ────────────────────────────────────────────────────────
    builder
      .addCase(fetchMessages.pending, (state) => { state.loadingMessages = true; state.error = null; })
      .addCase(fetchMessages.fulfilled, (state, { payload }) => {
        state.loadingMessages = false;
        const { conversationId, messages = [], pagination } = payload;
        messagesAdapter.setAll(getOrInitMsgState(state, conversationId), messages);
        state.messagePagination[conversationId] = {
          ...pagination,
          hasMore: (pagination?.page || 1) < (pagination?.pages || 1),
        };
      })
      .addCase(fetchMessages.rejected, (state, { payload }) => {
        state.loadingMessages = false; state.error = payload;
      });

    builder
      .addCase(fetchMoreMessages.pending,   (state) => { state.loadingMoreMessages = true; })
      .addCase(fetchMoreMessages.fulfilled, (state, { payload }) => {
        state.loadingMoreMessages = false;
        const { conversationId, messages = [], pagination } = payload;
        upsertMsgs(state, conversationId, messages);
        state.messagePagination[conversationId] = {
          ...pagination,
          hasMore: messages.length === (pagination?.limit || 30),
        };
      })
      .addCase(fetchMoreMessages.rejected, (state) => { state.loadingMoreMessages = false; });

    builder
      .addCase(sendMessage.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, payload.conversationId, payload.message);
      })
      .addCase(sendMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; state.error = payload;
        toast.error(payload || "Failed to send message");
      });

    builder
      .addCase(sendStickerMessage.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendStickerMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, payload.conversationId, payload.message);
      })
      .addCase(sendStickerMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; toast.error(payload || "Failed to send sticker");
      });

    builder
      .addCase(sendMediaMessage.pending,   (state) => { state.sendingMessage = true; state.uploadProgress = 0; })
      .addCase(sendMediaMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false; state.uploadProgress = 0;
        if (payload.message) upsertMsg(state, payload.conversationId, payload.message);
      })
      .addCase(sendMediaMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; state.uploadProgress = 0;
        toast.error(payload || "Media upload failed");
      });

    builder
      .addCase(sendMultipleMedia.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendMultipleMedia.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, payload.conversationId, payload.message);
        toast.success(`${payload.uploadedCount} file(s) sent`);
      })
      .addCase(sendMultipleMedia.rejected,  (state, { payload }) => {
        state.sendingMessage = false; toast.error(payload || "Upload failed");
      });

    builder
      .addCase(sendRecordingMessage.pending,   (state) => { state.sendingRecording = true; state.recordingProgress = 0; })
      .addCase(sendRecordingMessage.fulfilled, (state, { payload }) => {
        state.sendingRecording = false; state.recordingProgress = 0;
        if (payload.message) upsertMsg(state, payload.conversationId, payload.message);
      })
      .addCase(sendRecordingMessage.rejected,  (state, { payload }) => {
        state.sendingRecording = false; state.recordingProgress = 0;
        toast.error(payload || "Recording upload failed");
      });

    builder
      .addCase(socketUploadRecording.pending,   (state) => { state.sendingRecording = true; })
      .addCase(socketUploadRecording.fulfilled, (state, { payload }) => {
        state.sendingRecording = false;
        if (payload?.message) {
          const convId = payload.message.conversation?._id || payload.message.conversation;
          upsertMsg(state, convId, payload.message);
        }
      })
      .addCase(socketUploadRecording.rejected,  (state, { payload }) => {
        state.sendingRecording = false; toast.error(payload || "Recording upload failed");
      });

    builder
      .addCase(editMessage.fulfilled, (state, { payload }) => {
        if (payload.message) {
          const msgState = state.messages[payload.conversationId];
          if (msgState) messagesAdapter.updateOne(msgState, { id: payload.message._id, changes: payload.message });
        }
      })
      .addCase(editMessage.rejected, (_, { payload }) => { toast.error(payload || "Edit failed"); });

    builder
      .addCase(deleteMessage.fulfilled, (state, { payload }) => {
        const msgState = state.messages[payload.conversationId];
        if (msgState) {
          messagesAdapter.updateOne(msgState, {
            id:      payload.messageId,
            changes: {
              isDeleted:   true,
              deleteScope: payload.scope,
              ...(payload.scope === "deleted_for_everyone" ? { content: "", attachments: [] } : {}),
            },
          });
        }
      })
      .addCase(deleteMessage.rejected, (_, { payload }) => { toast.error(payload || "Delete failed"); });

    builder
      .addCase(reactToMessage.fulfilled, (state, { payload }) => {
        const msgState = state.messages[payload.conversationId];
        if (msgState?.entities[payload.messageId]) {
          messagesAdapter.updateOne(msgState, { id: payload.messageId, changes: { reactions: payload.reactions } });
        }
      })
      .addCase(reactToMessage.rejected, (_, { payload }) => { toast.error(payload || "Reaction failed"); });

    builder
      .addCase(pinMessage.fulfilled, (state, { payload }) => {
        const msgState = state.messages[payload.conversationId];
        if (msgState) messagesAdapter.updateOne(msgState, { id: payload.messageId, changes: { isPinned: payload.isPinned } });
        toast.success(payload.isPinned ? "Message pinned" : "Message unpinned");
      })
      .addCase(pinMessage.rejected, (_, { payload }) => { toast.error(payload || "Pin failed"); });

    builder.addCase(fetchPinnedMessages.fulfilled, (state, { payload }) => {
      state.pinnedMessages[payload.conversationId] = payload.messages || [];
    });

    builder
      .addCase(forwardMessage.fulfilled, (_, { payload }) => {
        toast.success(`Forwarded to ${payload.forwarded?.length || 0} conversation(s)`);
      })
      .addCase(forwardMessage.rejected, (_, { payload }) => { toast.error(payload || "Forward failed"); });

    builder.addCase(markMessageRead.fulfilled, (state, { payload }) => {
      const prev = state.unreadCounts[payload.conversationId] || 0;
      state.unreadCounts[payload.conversationId] = 0;
      state.totalUnreadCount = Math.max(0, state.totalUnreadCount - prev);
    });

    builder.addCase(markAllRead.fulfilled, (state, { payload }) => {
      const prev = state.unreadCounts[payload.conversationId] || 0;
      state.unreadCounts[payload.conversationId] = 0;
      state.totalUnreadCount = Math.max(0, state.totalUnreadCount - prev);
    });

    builder
      .addCase(searchMessages.pending,   (state, { meta }) => { state.searchLoading = true; state.searchQuery = meta.arg.q; })
      .addCase(searchMessages.fulfilled, (state, { payload }) => { state.searchLoading = false; state.searchResults = payload.messages || []; })
      .addCase(searchMessages.rejected,  (state) => { state.searchLoading = false; });

    builder.addCase(fetchMediaMessages.fulfilled, (state, { payload }) => {
      state.mediaMessages[payload.conversationId] = payload.messages || [];
    });

    builder.addCase(fetchScheduledMessages.fulfilled, (state, { payload }) => {
      state.scheduledMessages[payload.conversationId] = payload.messages || [];
    });

    builder
      .addCase(cancelScheduledMessage.fulfilled, (state, { payload }) => {
        if (state.scheduledMessages[payload.conversationId]) {
          state.scheduledMessages[payload.conversationId] =
            state.scheduledMessages[payload.conversationId].filter((m) => m._id !== payload.messageId);
        }
        toast.success("Scheduled message cancelled");
      })
      .addCase(cancelScheduledMessage.rejected, (_, { payload }) => { toast.error(payload || "Cancel failed"); });

    // ── Call REST thunks ─────────────────────────────────────────────────────

    /**
     * initiateCall REST — creates the DB call record.
     * After this resolves, call CallManager.initiateCall() for WebRTC,
     * then dispatch(setActiveCall({ ... })) to update the UI.
     */
    builder
      .addCase(initiateCall.fulfilled, (state, { payload }) => {
        // Only set activeCall if it isn't already set (CallManager may have
        // called setActiveCall first via its own flow)
        if (!state.activeCall) {
          state.activeCall = {
            conversationId:   payload.conversationId,
            callType:         payload.callType,
            messageId:        payload.messageId,
            status:           "calling",
            targetUserId:     null,   // set when callee's userId is known
            mediaConstraints: payload.constraints || {
              audio: true,
              video: payload.callType === "video",
            },
            caller:           null,
            callee:           null,
            callRinging:      false,
            peerMedia:        { audio: true, video: true },
            peerDisconnected: null,
          };
        }
      })
      .addCase(initiateCall.rejected, (_, { payload }) => {
        toast.error(payload || "Failed to initiate call");
      });

    builder.addCase(endCall.fulfilled, (state) => { state.activeCall = null; });

    builder.addCase(updateCallStatus.fulfilled, (state, { payload }) => {
      if (state.activeCall) state.activeCall.status = payload.status;
      if (payload.status === "declined" || payload.status === "missed") {
        state.activeCall   = null;
        state.incomingCall = null;
        toast.dismiss("incoming-call");
      }
    });

    // ── Presence ─────────────────────────────────────────────────────────────

    builder.addCase(fetchOnlinePresence.fulfilled, (state, { payload }) => {
      for (const [uid, data] of Object.entries(payload || {})) {
        state.presence[uid] = data;
      }
    });

    builder.addCase(fetchTotalUnreadCount.fulfilled, (state, { payload }) => {
      state.totalUnreadCount = payload;
    });

    builder.addCase(fetchConversationUnreadCount.fulfilled, (state, { payload }) => {
      state.unreadCounts[payload.conversationId] = payload.unreadCount;
    });

    // ── Admin ─────────────────────────────────────────────────────────────────

    builder
      .addCase(adminFetchConversations.pending,   (state) => { state.adminLoading = true; })
      .addCase(adminFetchConversations.fulfilled, (state, { payload }) => {
        state.adminLoading       = false;
        state.adminConversations = payload.conversations || [];
        state.adminPagination    = payload.pagination || state.adminPagination;
      })
      .addCase(adminFetchConversations.rejected,  (state, { payload }) => {
        state.adminLoading = false; toast.error(payload || "Admin fetch failed");
      });

    builder
      .addCase(adminDeleteMessage.fulfilled, (state, { payload: messageId }) => {
        const convId = findConvIdForMessage(state, messageId);
        if (convId) {
          messagesAdapter.updateOne(state.messages[convId], {
            id:      messageId,
            changes: { isDeleted: true, content: "[Removed by admin]", attachments: [] },
          });
        }
        toast.success("Message removed by admin");
      })
      .addCase(adminDeleteMessage.rejected, (_, { payload }) => {
        toast.error(payload || "Admin delete failed");
      });
  },
});

// ─────────────────────────────────────────────────────────────────────────────
// ACTION EXPORTS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  socketConnected,
  socketDisconnected,
  socketError,
  setActiveConversation,
  clearActiveConversation,
  setActiveCall,
  clearIncomingCall,
  clearActiveCall,

  _onConversationCreated,
  _onConversationUpdated,
  _onConversationDeleted,
  _onConversationMuteUpdated,
  _onMemberJoined,
  _onMemberLeft,
  _onMemberAdded,
  _onMemberRemoved,
  _onRemovedFromConversation,

  _onNewMessage,
  _onMessageEdited,
  _onMessageDeleted,
  _onMessageReaction,
  _onMessagePinUpdated,
  _onMessageScheduled,
  _onDeliveryReceipt,
  _onReadReceipt,

  _onTypingUpdate,

  _onUserOnline,
  _onUserOffline,
  _setPresenceBatch,

  _onCallIncoming,
  _onCallRinging,
  _onCallOffer,
  _onCallAnswered,
  _onCallIce,
  _onCallMediaToggle,
  _onCallEnded,
  _onCallDeclined,
  _onCallMissed,
  _onCallPeerDisconnected,
  _onCallMissedWhileOffline,

  _onNotification,
  _onMention,

  setUploadProgress,
  resetUploadProgress,
  setRecordingProgress,
  resetRecordingProgress,

  clearSearchResults,
  clearError,
  clearSuccess,
  resetChatState,
} = chatSlice.actions;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

const selectChatState = (state) => state.chat;

export const {
  selectAll:   selectAllConversations,
  selectById:  selectConversationById,
  selectIds:   selectConversationIds,
  selectTotal: selectTotalConversations,
} = conversationsAdapter.getSelectors(selectChatState);

export const selectActiveConversationId   = (state) => state.chat.activeConversationId;
export const selectConversationPagination = (state) => state.chat.conversationPagination;
export const selectLoadingConversations   = (state) => state.chat.loadingConversations;
export const selectLoadingConversation    = (state) => state.chat.loadingConversation;

export const selectActiveConversation = createSelector(
  selectChatState,
  (s) => (s.activeConversationId ? s.entities[s.activeConversationId] : null)
);

export const selectMessagesByConversation = createSelector(
  [selectChatState, (_, conversationId) => conversationId],
  (s, conversationId) => {
    const ms = s.messages[conversationId];
    if (!ms) return [];
    return messagesAdapter.getSelectors().selectAll(ms);
  }
);

export const selectMessageById = createSelector(
  [selectChatState, (_, conversationId) => conversationId, (_, __, messageId) => messageId],
  (s, conversationId, messageId) => s.messages[conversationId]?.entities[messageId] || null
);

export const selectMessagePagination  = (conversationId) => (state) =>
  state.chat.messagePagination[conversationId] || { hasMore: false };
export const selectLoadingMessages     = (state) => state.chat.loadingMessages;
export const selectLoadingMoreMessages = (state) => state.chat.loadingMoreMessages;
export const selectSendingMessage      = (state) => state.chat.sendingMessage;
export const selectUploadProgress      = (state) => state.chat.uploadProgress;
export const selectSendingRecording    = (state) => state.chat.sendingRecording;
export const selectRecordingProgress   = (state) => state.chat.recordingProgress;

export const selectPinnedMessages    = (conversationId) => (state) =>
  state.chat.pinnedMessages[conversationId] || [];
export const selectScheduledMessages = (conversationId) => (state) =>
  state.chat.scheduledMessages[conversationId] || [];

export const selectTypingUsers = (conversationId) => (state) =>
  Object.values(state.chat.typing[conversationId] || {}).filter((u) => u.isTyping);

export const selectUserPresence = (userId) => (state) =>
  state.chat.presence[userId] || { isOnline: false };

export const selectTotalUnreadCount = (state) => state.chat.totalUnreadCount;
export const selectUnreadCount      = (conversationId) => (state) =>
  state.chat.unreadCounts[conversationId] || 0;

export const selectSearchResults = (state) => state.chat.searchResults;
export const selectSearchLoading  = (state) => state.chat.searchLoading;
export const selectSearchQuery    = (state) => state.chat.searchQuery;

export const selectMediaMessages = (conversationId) => (state) =>
  state.chat.mediaMessages[conversationId] || [];

export const selectPartners          = (state) => state.chat.partners;
export const selectPartnerPagination = (state) => state.chat.partnerPagination;
export const selectLoadingPartners   = (state) => state.chat.loadingPartners;

export const selectDepartmentChannel = (state) => state.chat.departmentChannel;

// ── Call selectors ────────────────────────────────────────────────────────────
export const selectActiveCall           = (state) => state.chat.activeCall;
export const selectIncomingCall         = (state) => state.chat.incomingCall;
export const selectCallStatus           = (state) => state.chat.activeCall?.status        || null;
export const selectCallType             = (state) => state.chat.activeCall?.callType      || null;
export const selectCallRinging          = (state) => state.chat.activeCall?.callRinging   || false;
export const selectCallPeerMedia        = (state) => state.chat.activeCall?.peerMedia     || null;
export const selectCallMediaConstraints = (state) => state.chat.activeCall?.mediaConstraints || null;
export const selectCallPeerDisconnected = (state) => state.chat.activeCall?.peerDisconnected || null;
export const selectCallTargetUserId     = (state) => state.chat.activeCall?.targetUserId  || null;  // NEW
// REMOVED: selectCallIceCandidates, selectCallPeerSdpAnswer, selectIncomingSdpOffer
// These were incorrect — CallManager owns that data, not Redux.

// ── Socket ────────────────────────────────────────────────────────────────────
export const selectSocketConnected    = (state) => state.chat.socketConnected;
export const selectSocketError        = (state) => state.chat.socketError;
export const selectSocketReconnecting = (state) => state.chat.socketReconnecting;

// ── Admin ─────────────────────────────────────────────────────────────────────
export const selectAdminConversations = (state) => state.chat.adminConversations;
export const selectAdminPagination    = (state) => state.chat.adminPagination;
export const selectAdminLoading       = (state) => state.chat.adminLoading;

// ── Global ────────────────────────────────────────────────────────────────────
export const selectChatError   = (state) => state.chat.error;
export const selectChatSuccess = (state) => state.chat.success;

export default chatSlice.reducer;