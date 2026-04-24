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
// ─────────────────────────────────────────────────────────────────────────────

let _callManagerInstance = null;

export function setCallManager(instance) {
  _callManagerInstance = instance;
}

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

// FIX #13: Normalise any conversationId value (ObjectId object, string, or plain id)
// to a plain string so it always matches state keys without mismatch.
function toStringId(id) {
  if (!id) return null;
  if (typeof id === 'string') return id;
  if (typeof id === 'object' && id._id) return String(id._id);
  return String(id);
}

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS — SOCKET
// ─────────────────────────────────────────────────────────────────────────────

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

      _socket.on("connect",       ()  => dispatch(socketConnected()));
      _socket.on("disconnect",    (r) => dispatch(socketDisconnected(r)));
      _socket.on("connect_error", (e) => dispatch(socketError(e.message)));

      _socket.on("conversation:created",          (p) => dispatch(_onConversationCreated(p)));
      _socket.on("conversation:updated",          (p) => dispatch(_onConversationUpdated(p)));
      _socket.on("conversation:deleted",          (p) => dispatch(_onConversationDeleted(p)));
      _socket.on("conversation:member_joined",    (p) => dispatch(_onMemberJoined(p)));
      _socket.on("conversation:member_left",      (p) => dispatch(_onMemberLeft(p)));
      _socket.on("conversation:member_added",     (p) => dispatch(_onMemberAdded(p)));
      _socket.on("conversation:member_removed",   (p) => dispatch(_onMemberRemoved(p)));
      _socket.on("conversation:you_were_removed", (p) => dispatch(_onRemovedFromConversation(p)));
      _socket.on("conversation:mute_updated",     (p) => dispatch(_onConversationMuteUpdated(p)));

      _socket.on("message:new",              (p) => dispatch(_onNewMessage(p)));
      _socket.on("message:edited",           (p) => dispatch(_onMessageEdited(p)));
      _socket.on("message:deleted",          (p) => dispatch(_onMessageDeleted(p)));
      _socket.on("message:reaction",         (p) => dispatch(_onMessageReaction(p)));
      _socket.on("message:pin_updated",      (p) => dispatch(_onMessagePinUpdated(p)));
      _socket.on("message:scheduled",        (p) => dispatch(_onMessageScheduled(p)));
      _socket.on("message:delivery_receipt", (p) => dispatch(_onDeliveryReceipt(p)));
      _socket.on("message:read_receipt",     (p) => dispatch(_onReadReceipt(p)));

      _socket.on("typing:update", (p) => dispatch(_onTypingUpdate(p)));

      _socket.on("call:incoming",            (p) => dispatch(_onCallIncoming(p)));
      _socket.on("call:ringing",             (p) => dispatch(_onCallRinging(p)));
      _socket.on("call:offer",               (p) => dispatch(_onCallOffer(p)));
      _socket.on("call:answered",            (p) => dispatch(_onCallAnswered(p)));
      _socket.on("call:ice",                 (p) => dispatch(_onCallIce(p)));
      _socket.on("call:media_toggle",        (p) => dispatch(_onCallMediaToggle(p)));
      _socket.on("call:ended",               (p) => dispatch(_onCallEnded(p)));
      _socket.on("call:declined",            (p) => dispatch(_onCallDeclined(p)));
      _socket.on("call:missed",              (p) => dispatch(_onCallMissed(p)));
      _socket.on("call:peer_disconnected",   (p) => dispatch(_onCallPeerDisconnected(p)));
      _socket.on("call:missed_while_offline",(p) => dispatch(_onCallMissedWhileOffline(p)));

      _socket.on("user:online",  (p) => dispatch(_onUserOnline(p)));
      _socket.on("user:offline", (p) => dispatch(_onUserOffline(p)));

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

// FIX #14: socketSendMessage — reject path fixed.
// Original used Promise constructor with reject() call in a non-returning branch,
// meaning the thunk resolved undefined when socket is disconnected instead of
// rejecting → no error toast. Now returns a proper rejected Promise.
export const socketSendMessage = createAsyncThunk(
  "chat/socketSendMessage",
  async (payload, { rejectWithValue }) => {
    if (!_socket?.connected) {
      return rejectWithValue("Socket not connected");
    }
    return new Promise((resolve, reject) => {
      _socket.emit("message:send", payload, (ack) => {
        if (ack?.success) resolve(ack);
        else reject(ack?.message || "Failed to send message");
      });
    }).catch((err) => rejectWithValue(typeof err === 'string' ? err : err?.message || "Send failed"));
  }
);

export const socketUploadRecording = createAsyncThunk(
  "chat/socketUploadRecording",
  async (payload, { rejectWithValue }) => {
    if (!_socket?.connected) {
      return rejectWithValue("Socket not connected");
    }
    return new Promise((resolve, reject) => {
      _socket.emit("call:recording_upload", payload, (ack) => {
        if (ack?.success) resolve(ack);
        else reject(ack?.message || "Recording upload failed");
      });
    }).catch((err) => rejectWithValue(typeof err === 'string' ? err : err?.message || "Upload failed"));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SOCKET EMIT HELPERS — CALLS
// ─────────────────────────────────────────────────────────────────────────────

export const socketCallRinging = (payload) => () => {
  _socket?.emit("call:ringing", payload);
};

export const socketCallEnd = (payload) => () => {
  _socket?.emit("call:end", payload);
};

export const socketCallDecline = (payload) => () => {
  _socket?.emit("call:decline", payload);
};

export const socketCallMissed = (payload) => () => {
  _socket?.emit("call:missed", payload);
};

export const socketCallMediaToggle = (payload) => () => {
  _socket?.emit("call:media_toggle", payload);
};

export const socketTypingStart = (conversationId) => () => {
  _socket?.emit("typing:start", { conversationId });
};

export const socketTypingStop = (conversationId) => () => {
  _socket?.emit("typing:stop", { conversationId });
};

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
  ...conversationsAdapter.getInitialState(),
  conversationPagination: { page: 1, limit: 30, total: 0, pages: 0 },
  loadingConversations:   false,
  loadingConversation:    false,

  activeConversationId: null,

  messages:             {},
  messagePagination:    {},
  loadingMessages:      false,
  loadingMoreMessages:  false,
  sendingMessage:       false,
  uploadProgress:       0,

  sendingRecording:     false,
  recordingProgress:    0,

  pinnedMessages:       {},
  scheduledMessages:    {},
  mediaMessages:        {},

  searchResults:        [],
  searchLoading:        false,
  searchQuery:          "",

  typing:               {},
  presence:             {},

  totalUnreadCount:     0,
  unreadCounts:         {},

  partners:             [],
  partnerPagination:    { page: 1, total: 0, pages: 0 },
  loadingPartners:      false,

  departmentChannel:    null,

  activeCall:           null,
  incomingCall:         null,

  socketConnected:      false,
  socketError:          null,
  socketReconnecting:   false,

  adminConversations:   [],
  adminPagination:      { page: 1, total: 0, pages: 0 },
  adminLoading:         false,

  error:                null,
  success:              null,
};

// ─────────────────────────────────────────────────────────────────────────────
// PER-CONVERSATION MESSAGE ADAPTER HELPERS
// ─────────────────────────────────────────────────────────────────────────────

function getOrInitMsgState(state, conversationId) {
  // FIX #13: Always coerce to string so ObjectId objects don't create separate keys
  const key = toStringId(conversationId);
  if (!key) return null;
  if (!state.messages[key]) {
    state.messages[key] = messagesAdapter.getInitialState();
  }
  return state.messages[key];
}

function upsertMsg(state, conversationId, message) {
  const ms = getOrInitMsgState(state, conversationId);
  if (ms) messagesAdapter.upsertOne(ms, message);
}

function upsertMsgs(state, conversationId, messages) {
  const ms = getOrInitMsgState(state, conversationId);
  if (ms) messagesAdapter.upsertMany(ms, messages);
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

    setActiveConversation(state, { payload }) {
      // FIX #13: coerce to string
      const id = toStringId(payload);
      state.activeConversationId = id;
      if (id) {
        const prev = state.unreadCounts[id] || 0;
        state.totalUnreadCount   = Math.max(0, state.totalUnreadCount - prev);
        state.unreadCounts[id]   = 0;
      }
    },
    clearActiveConversation(state) {
      state.activeConversationId = null;
    },

    _onConversationCreated(state, { payload }) {
      const { conversation } = payload;
      if (conversation) conversationsAdapter.upsertOne(state, conversation);
    },

    _onConversationUpdated(state, { payload }) {
      const { conversationId, updates } = payload;
      if (conversationId && updates) {
        conversationsAdapter.updateOne(state, { id: toStringId(conversationId), changes: updates });
      }
    },

    _onConversationDeleted(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      if (!convId) return;
      conversationsAdapter.removeOne(state, convId);
      if (state.messages[convId]) delete state.messages[convId];
      if (state.activeConversationId === convId) state.activeConversationId = null;
    },

    _onConversationMuteUpdated(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      const conv = state.entities[convId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      convId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === payload.userId?.toString()
              ? { ...p, isMuted: payload.isMuted, mutedUntil: payload.mutedUntil }
              : p
          ),
        },
      });
    },

    _onMemberJoined(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      const conv = state.entities[convId];
      if (!conv || !payload.user) return;
      const exists = conv.participants?.find(
        (p) => (p.user?._id || p.user)?.toString() === payload.user._id?.toString()
      );
      if (!exists) {
        conversationsAdapter.updateOne(state, {
          id:      convId,
          changes: {
            participants: [
              ...(conv.participants || []),
              { user: payload.user, isActive: true, joinedAt: new Date().toISOString(), conversationRole: "member" },
            ],
          },
        });
      }
    },

    _onMemberLeft(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      const conv = state.entities[convId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      convId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === payload.userId?.toString()
              ? { ...p, isActive: false, leftAt: new Date().toISOString() }
              : p
          ),
        },
      });
    },

    _onMemberAdded(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      const conv = state.entities[convId];
      if (!conv || !payload.addedUser) return;
      const exists = conv.participants?.find(
        (p) => (p.user?._id || p.user)?.toString() === payload.addedUser._id?.toString()
      );
      if (!exists) {
        conversationsAdapter.updateOne(state, {
          id:      convId,
          changes: {
            participants: [
              ...(conv.participants || []),
              { user: payload.addedUser, isActive: true, conversationRole: "member" },
            ],
          },
        });
      }
    },

    _onMemberRemoved(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      const conv = state.entities[convId];
      if (!conv) return;
      conversationsAdapter.updateOne(state, {
        id:      convId,
        changes: {
          participants: conv.participants?.map((p) =>
            (p.user?._id || p.user)?.toString() === payload.targetUserId?.toString()
              ? { ...p, isActive: false }
              : p
          ),
        },
      });
    },

    _onRemovedFromConversation(state, { payload }) {
      const convId = toStringId(payload?.conversationId);
      conversationsAdapter.removeOne(state, convId);
      if (state.messages[convId]) delete state.messages[convId];
      if (state.activeConversationId === convId) state.activeConversationId = null;
      toast("You were removed from a conversation.", { icon: "ℹ️" });
    },

    // FIX #13: conversationId coerced to string before use as state key
    _onNewMessage(state, { payload }) {
      const { message } = payload;
      if (!message) return;
      // FIX #13: Always coerce to string
      const convId = toStringId(message.conversation?._id || message.conversation);
      if (!convId) return;

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
      const convId = toStringId(message.conversation?._id || message.conversation);
      if (!convId) return;
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
      const key = toStringId(conversationId);
      const msgState = state.messages[key];
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

    _onTypingUpdate(state, { payload }) {
      const { conversationId, userId, name, isTyping } = payload;
      if (!conversationId) return;
      const key = toStringId(conversationId);
      if (!state.typing[key]) state.typing[key] = {};
      if (isTyping) {
        state.typing[key][userId] = { name, isTyping: true };
      } else {
        delete state.typing[key][userId];
      }
    },

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

    _onCallIncoming(state, { payload }) {
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
      };
      toast(
        `📞 Incoming ${payload.callType} call from ${payload.caller?.name}`,
        { duration: 30000, id: "incoming-call" }
      );
    },

    _onCallRinging(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status      = "ringing";
      state.activeCall.callRinging = true;
      state.activeCall.callee      = payload.user || null;
    },

    _onCallOffer(state, { payload }) {
      if (state.activeCall) {
        state.activeCall.status = "connecting";
        if (payload.from && !state.activeCall.targetUserId) {
          state.activeCall.targetUserId = payload.from;
        }
      }
      if (state.incomingCall && payload.caller) {
        state.incomingCall.caller = payload.caller;
      }
    },

    _onCallAnswered(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status = "connecting";
      state.activeCall.callee = payload.callee || null;
      if (payload.from && !state.activeCall.targetUserId) {
        state.activeCall.targetUserId = payload.from;
      }
      toast.dismiss("incoming-call");
    },

    // Intentional NO-OP — CallManager handles ICE
    // eslint-disable-next-line no-unused-vars
    _onCallIce(_state, _action) {},

    _onCallMediaToggle(state, { payload }) {
      if (!state.activeCall) return;
      if (!state.activeCall.peerMedia) {
        state.activeCall.peerMedia = { audio: true, video: true };
      }
      if (payload.kind === "audio" || payload.kind === "video") {
        state.activeCall.peerMedia[payload.kind] = payload.enabled;
      }
    },

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

    _onCallDeclined(state, { payload }) {
      state.activeCall   = null;
      state.incomingCall = null;
      toast.dismiss("incoming-call");
      const name = payload?.declinedByUser?.name;
      toast(name ? `${name} declined the call` : "Call declined.", { icon: "📵" });
    },

    _onCallMissed(state) {
      state.activeCall   = null;
      state.incomingCall = null;
      toast.dismiss("incoming-call");
      toast("Missed call", { icon: "📵" });
    },

    _onCallPeerDisconnected(state, { payload }) {
      if (!state.activeCall) return;
      state.activeCall.status           = "reconnecting";
      state.activeCall.peerDisconnected = {
        userId:   payload.userId,
        userName: payload.userName,
      };
    },

    _onCallMissedWhileOffline(state, { payload }) {
      void state;
      toast(
        `📵 Missed ${payload.callType || ""} call from ${payload.caller?.name || "someone"} while offline`,
        { duration: 8000 }
      );
    },

    setActiveCall(state, { payload }) {
      state.activeCall = {
        status:           "calling",
        mediaConstraints: { audio: true, video: payload.callType === "video" },
        caller:           null,
        callee:           null,
        callRinging:      false,
        peerMedia:        { audio: true, video: true },
        peerDisconnected: null,
        ...payload,
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

    _onNotification(state, { payload }) { void state; void payload; },
    _onMention(state, { payload }) {
      toast(`You were mentioned by ${payload.mentionedBy?.name}`, { icon: "🔔" });
    },

    setUploadProgress(state, { payload })   { state.uploadProgress    = payload; },
    resetUploadProgress(state)              { state.uploadProgress    = 0; },
    setRecordingProgress(state, { payload }){ state.recordingProgress = payload; },
    resetRecordingProgress(state)           { state.recordingProgress = 0; },

    clearSearchResults(state) { state.searchResults = []; state.searchQuery = ""; },
    clearError(state)         { state.error   = null; },
    clearSuccess(state)       { state.success = null; },
    resetChatState()          { return initialState; },
  },

  extraReducers: (builder) => {

    builder.addCase(connectSocket.rejected, (state, { payload }) => {
      state.socketError = payload;
      toast.error("Chat connection failed");
    });

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

    builder
      .addCase(fetchMessages.pending, (state) => { state.loadingMessages = true; state.error = null; })
      .addCase(fetchMessages.fulfilled, (state, { payload }) => {
        state.loadingMessages = false;
        const { conversationId, messages = [], pagination } = payload;
        const key = toStringId(conversationId);
        if (key) {
          messagesAdapter.setAll(getOrInitMsgState(state, key), messages);
          state.messagePagination[key] = {
            ...pagination,
            hasMore: (pagination?.page || 1) < (pagination?.pages || 1),
          };
        }
      })
      .addCase(fetchMessages.rejected, (state, { payload }) => {
        state.loadingMessages = false; state.error = payload;
      });

    builder
      .addCase(fetchMoreMessages.pending,   (state) => { state.loadingMoreMessages = true; })
      .addCase(fetchMoreMessages.fulfilled, (state, { payload }) => {
        state.loadingMoreMessages = false;
        const { conversationId, messages = [], pagination } = payload;
        const key = toStringId(conversationId);
        if (key) {
          upsertMsgs(state, key, messages);
          state.messagePagination[key] = {
            ...pagination,
            hasMore: messages.length === (pagination?.limit || 30),
          };
        }
      })
      .addCase(fetchMoreMessages.rejected, (state) => { state.loadingMoreMessages = false; });

    builder
      .addCase(sendMessage.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, toStringId(payload.conversationId), payload.message);
      })
      .addCase(sendMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; state.error = payload;
        toast.error(payload || "Failed to send message");
      });

    builder
      .addCase(sendStickerMessage.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendStickerMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, toStringId(payload.conversationId), payload.message);
      })
      .addCase(sendStickerMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; toast.error(payload || "Failed to send sticker");
      });

    builder
      .addCase(sendMediaMessage.pending,   (state) => { state.sendingMessage = true; state.uploadProgress = 0; })
      .addCase(sendMediaMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false; state.uploadProgress = 0;
        if (payload.message) upsertMsg(state, toStringId(payload.conversationId), payload.message);
      })
      .addCase(sendMediaMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false; state.uploadProgress = 0;
        toast.error(payload || "Media upload failed");
      });

    builder
      .addCase(sendMultipleMedia.pending,   (state) => { state.sendingMessage = true; })
      .addCase(sendMultipleMedia.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload.message) upsertMsg(state, toStringId(payload.conversationId), payload.message);
        toast.success(`${payload.uploadedCount} file(s) sent`);
      })
      .addCase(sendMultipleMedia.rejected,  (state, { payload }) => {
        state.sendingMessage = false; toast.error(payload || "Upload failed");
      });

    builder
      .addCase(sendRecordingMessage.pending,   (state) => { state.sendingRecording = true; state.recordingProgress = 0; })
      .addCase(sendRecordingMessage.fulfilled, (state, { payload }) => {
        state.sendingRecording = false; state.recordingProgress = 0;
        if (payload.message) upsertMsg(state, toStringId(payload.conversationId), payload.message);
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
          const convId = toStringId(payload.message.conversation?._id || payload.message.conversation);
          upsertMsg(state, convId, payload.message);
        }
      })
      .addCase(socketUploadRecording.rejected,  (state, { payload }) => {
        state.sendingRecording = false; toast.error(payload || "Recording upload failed");
      });

    // FIX #14: socketSendMessage.rejected now fires correctly — show error toast
    builder
      .addCase(socketSendMessage.pending,   (state) => { state.sendingMessage = true; })
      .addCase(socketSendMessage.fulfilled, (state, { payload }) => {
        state.sendingMessage = false;
        if (payload?.message) {
          const convId = toStringId(payload.message.conversation?._id || payload.message.conversation);
          upsertMsg(state, convId, payload.message);
        }
      })
      .addCase(socketSendMessage.rejected,  (state, { payload }) => {
        state.sendingMessage = false;
        toast.error(payload || "Failed to send message");
      });

    builder
      .addCase(editMessage.fulfilled, (state, { payload }) => {
        if (payload.message) {
          const key = toStringId(payload.conversationId);
          const msgState = state.messages[key];
          if (msgState) messagesAdapter.updateOne(msgState, { id: payload.message._id, changes: payload.message });
        }
      })
      .addCase(editMessage.rejected, (_, { payload }) => { toast.error(payload || "Edit failed"); });

    builder
      .addCase(deleteMessage.fulfilled, (state, { payload }) => {
        const key = toStringId(payload.conversationId);
        const msgState = state.messages[key];
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
        const key = toStringId(payload.conversationId);
        const msgState = state.messages[key];
        if (msgState?.entities[payload.messageId]) {
          messagesAdapter.updateOne(msgState, { id: payload.messageId, changes: { reactions: payload.reactions } });
        }
      })
      .addCase(reactToMessage.rejected, (_, { payload }) => { toast.error(payload || "Reaction failed"); });

    builder
      .addCase(pinMessage.fulfilled, (state, { payload }) => {
        const key = toStringId(payload.conversationId);
        const msgState = state.messages[key];
        if (msgState) messagesAdapter.updateOne(msgState, { id: payload.messageId, changes: { isPinned: payload.isPinned } });
        toast.success(payload.isPinned ? "Message pinned" : "Message unpinned");
      })
      .addCase(pinMessage.rejected, (_, { payload }) => { toast.error(payload || "Pin failed"); });

    builder.addCase(fetchPinnedMessages.fulfilled, (state, { payload }) => {
      state.pinnedMessages[toStringId(payload.conversationId)] = payload.messages || [];
    });

    builder
      .addCase(forwardMessage.fulfilled, (_, { payload }) => {
        toast.success(`Forwarded to ${payload.forwarded?.length || 0} conversation(s)`);
      })
      .addCase(forwardMessage.rejected, (_, { payload }) => { toast.error(payload || "Forward failed"); });

    builder.addCase(markMessageRead.fulfilled, (state, { payload }) => {
      const key = toStringId(payload.conversationId);
      const prev = state.unreadCounts[key] || 0;
      state.unreadCounts[key]   = 0;
      state.totalUnreadCount    = Math.max(0, state.totalUnreadCount - prev);
    });

    builder.addCase(markAllRead.fulfilled, (state, { payload }) => {
      const key = toStringId(payload.conversationId);
      const prev = state.unreadCounts[key] || 0;
      state.unreadCounts[key]   = 0;
      state.totalUnreadCount    = Math.max(0, state.totalUnreadCount - prev);
    });

    builder
      .addCase(searchMessages.pending,   (state, { meta }) => { state.searchLoading = true; state.searchQuery = meta.arg.q; })
      .addCase(searchMessages.fulfilled, (state, { payload }) => { state.searchLoading = false; state.searchResults = payload.messages || []; })
      .addCase(searchMessages.rejected,  (state) => { state.searchLoading = false; });

    builder.addCase(fetchMediaMessages.fulfilled, (state, { payload }) => {
      state.mediaMessages[toStringId(payload.conversationId)] = payload.messages || [];
    });

    builder.addCase(fetchScheduledMessages.fulfilled, (state, { payload }) => {
      state.scheduledMessages[toStringId(payload.conversationId)] = payload.messages || [];
    });

    builder
      .addCase(cancelScheduledMessage.fulfilled, (state, { payload }) => {
        const key = toStringId(payload.conversationId);
        if (state.scheduledMessages[key]) {
          state.scheduledMessages[key] =
            state.scheduledMessages[key].filter((m) => m._id !== payload.messageId);
        }
        toast.success("Scheduled message cancelled");
      })
      .addCase(cancelScheduledMessage.rejected, (_, { payload }) => { toast.error(payload || "Cancel failed"); });

    builder
      .addCase(initiateCall.fulfilled, (state, { payload }) => {
        if (!state.activeCall) {
          state.activeCall = {
            conversationId:   payload.conversationId,
            callType:         payload.callType,
            messageId:        payload.messageId,
            status:           "calling",
            targetUserId:     null,
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

    builder.addCase(fetchOnlinePresence.fulfilled, (state, { payload }) => {
      for (const [uid, data] of Object.entries(payload || {})) {
        state.presence[uid] = data;
      }
    });

    builder.addCase(fetchTotalUnreadCount.fulfilled, (state, { payload }) => {
      state.totalUnreadCount = payload;
    });

    builder.addCase(fetchConversationUnreadCount.fulfilled, (state, { payload }) => {
      state.unreadCounts[toStringId(payload.conversationId)] = payload.unreadCount;
    });

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

// FIX #13: Selector coerces conversationId to string for consistent lookup
export const selectMessagesByConversation = createSelector(
  [selectChatState, (_, conversationId) => toStringId(conversationId)],
  (s, conversationId) => {
    if (!conversationId) return [];
    const ms = s.messages[conversationId];
    if (!ms) return [];
    return messagesAdapter.getSelectors().selectAll(ms);
  }
);

export const selectMessageById = createSelector(
  [selectChatState, (_, conversationId) => toStringId(conversationId), (_, __, messageId) => messageId],
  (s, conversationId, messageId) => {
    if (!conversationId) return null;
    return s.messages[conversationId]?.entities[messageId] || null;
  }
);

export const selectMessagePagination  = (conversationId) => (state) =>
  state.chat.messagePagination[toStringId(conversationId)] || { hasMore: false };
export const selectLoadingMessages     = (state) => state.chat.loadingMessages;
export const selectLoadingMoreMessages = (state) => state.chat.loadingMoreMessages;
export const selectSendingMessage      = (state) => state.chat.sendingMessage;
export const selectUploadProgress      = (state) => state.chat.uploadProgress;
export const selectSendingRecording    = (state) => state.chat.sendingRecording;
export const selectRecordingProgress   = (state) => state.chat.recordingProgress;

export const selectPinnedMessages    = (conversationId) => (state) =>
  state.chat.pinnedMessages[toStringId(conversationId)] || [];
export const selectScheduledMessages = (conversationId) => (state) =>
  state.chat.scheduledMessages[toStringId(conversationId)] || [];

export const selectTypingUsers = (conversationId) => (state) =>
  Object.values(state.chat.typing[toStringId(conversationId)] || {}).filter((u) => u.isTyping);

export const selectUserPresence = (userId) => (state) =>
  state.chat.presence[userId] || { isOnline: false };

export const selectTotalUnreadCount = (state) => state.chat.totalUnreadCount;
export const selectUnreadCount      = (conversationId) => (state) =>
  state.chat.unreadCounts[toStringId(conversationId)] || 0;

export const selectSearchResults = (state) => state.chat.searchResults;
export const selectSearchLoading  = (state) => state.chat.searchLoading;
export const selectSearchQuery    = (state) => state.chat.searchQuery;

export const selectMediaMessages = (conversationId) => (state) =>
  state.chat.mediaMessages[toStringId(conversationId)] || [];

export const selectPartners          = (state) => state.chat.partners;
export const selectPartnerPagination = (state) => state.chat.partnerPagination;
export const selectLoadingPartners   = (state) => state.chat.loadingPartners;

export const selectDepartmentChannel = (state) => state.chat.departmentChannel;

export const selectActiveCall           = (state) => state.chat.activeCall;
export const selectIncomingCall         = (state) => state.chat.incomingCall;
export const selectCallStatus           = (state) => state.chat.activeCall?.status        || null;
export const selectCallType             = (state) => state.chat.activeCall?.callType      || null;
export const selectCallRinging          = (state) => state.chat.activeCall?.callRinging   || false;
export const selectCallPeerMedia        = (state) => state.chat.activeCall?.peerMedia     || null;
export const selectCallMediaConstraints = (state) => state.chat.activeCall?.mediaConstraints || null;
export const selectCallPeerDisconnected = (state) => state.chat.activeCall?.peerDisconnected || null;
export const selectCallTargetUserId     = (state) => state.chat.activeCall?.targetUserId  || null;

export const selectSocketConnected    = (state) => state.chat.socketConnected;
export const selectSocketError        = (state) => state.chat.socketError;
export const selectSocketReconnecting = (state) => state.chat.socketReconnecting;

export const selectAdminConversations = (state) => state.chat.adminConversations;
export const selectAdminPagination    = (state) => state.chat.adminPagination;
export const selectAdminLoading       = (state) => state.chat.adminLoading;

export const selectChatError   = (state) => state.chat.error;
export const selectChatSuccess = (state) => state.chat.success;

export default chatSlice.reducer;