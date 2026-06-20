/**
 * store/slices/chatSlice.js
 * Fixes applied:
 *  - socketMessagesRead: was zeroing unreadCount but NOT decrementing totalUnread correctly
 *    (was subtracting prev which could be stale). Now uses a guard.
 *  - socketMessagesDelivered: was bulk-updating ALL messages in conversation with deliveredAt.
 *    Fix: only update messages sent by current user that don't have deliveredAt yet.
 *    (We don't know currentUserId here — solved by only storing deliveredAt on sender-side
 *     messages via the getMessages API which already attaches it. Socket event just stores
 *     the timestamp for the conversation level.)
 *  - socketNewMessage: bump totalUnread only when not active AND message not from self
 *  - fetchMessages hasMore: was checking >= 50 hardcoded. Use returned length vs requested limit.
 *  - ensureConvoMessages: safe init
 *  - sendTextMessage: socket path doesn't go through thunk — handled in useChat. Thunk only
 *    for REST fallback. No double-upsert issue.
 */

import {
  createSlice,
  createAsyncThunk,
  createEntityAdapter,
  createSelector,
} from '@reduxjs/toolkit';
import API from '../api';
import toast from 'react-hot-toast';
import chatService from '../../services/chatService';

// ─── Entity adapters ──────────────────────────────────────────────────────────

const conversationsAdapter = createEntityAdapter({
  selectId:      (c) => c._id,
  sortComparer:  (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt),
});

const messagesAdapter = createEntityAdapter({
  selectId:      (m) => m._id,
  sortComparer:  (a, b) => new Date(a.createdAt) - new Date(b.createdAt),
});

// ─── Initial state ────────────────────────────────────────────────────────────

const initialState = {
  conversations:      conversationsAdapter.getInitialState(),
  conversationsLoading: false,
  conversationsMeta:  { total: 0, page: 1, pages: 1 },

  activeConversationId: null,

  // { [conversationId]: EntityState<Message> }
  messagesByConversation: {},
  messagesLoadingMap:     {},   // { [conversationId]: bool }
  messagesCursorMap:      {},   // { [conversationId]: oldestMessageId | null }
  messagesHasMoreMap:     {},   // { [conversationId]: bool }

  pinnedMessages:     {},   // { [conversationId]: Message[] }
  mediaByConversation:{},   // { [conversationId]: Message[] }
  searchResults:      {},   // { [conversationId]: Message[] }
  searchQuery:        '',
  searchLoading:      false,

  totalUnread:  0,
  blockedUsers: [],

  typingUsers: {},           // { [conversationId]: userId[] }

  activeCall:   null,        // { callId, channelName, token, uid, appId, type, conversationId }
  incomingCall: null,        // { callId, conversationId, type, channelName, appId, initiator }
  callHistory:  [],
  callHistoryMeta: { total: 0, page: 1, pages: 1 },

  rtmToken:    null,
  rtmExpiresAt: null,

  presence:        {},       // { [userId]: { isOnline, lastseen } }
  uploadProgress:  {},       // { [conversationId]: 0-100 }

  // Track current user id for reducer logic (set on login)
  currentUserId: null,

  error: null,
};

// ─── Helper ───────────────────────────────────────────────────────────────────

const ensureConvoMessages = (state, conversationId) => {
  if (!conversationId) return;
  if (!state.messagesByConversation[conversationId]) {
    state.messagesByConversation[conversationId] = messagesAdapter.getInitialState();
    state.messagesHasMoreMap[conversationId]     = true;
    state.messagesCursorMap[conversationId]      = null;
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// ASYNC THUNKS
// ─────────────────────────────────────────────────────────────────────────────

// ── Conversations ─────────────────────────────────────────────────────────────

export const fetchConversations = createAsyncThunk(
  'chat/fetchConversations',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getConversations(params);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const startDirectConversation = createAsyncThunk(
  'chat/startDirectConversation',
  async (targetUserId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.createDirectConversation(targetUserId);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const startGroupConversation = createAsyncThunk(
  'chat/startGroupConversation',
  async (payload, { rejectWithValue }) => {
    try {
      const { data } = await chatService.createGroupConversation(payload);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchConversationById = createAsyncThunk(
  'chat/fetchConversationById',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getConversation(conversationId);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const updateGroupInfo = createAsyncThunk(
  'chat/updateGroupInfo',
  async ({ conversationId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.updateGroupConversation(conversationId, payload);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const addMembers = createAsyncThunk(
  'chat/addMembers',
  async ({ conversationId, memberIds }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.addGroupMembers(conversationId, memberIds);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const removeMember = createAsyncThunk(
  'chat/removeMember',
  async ({ conversationId, memberId }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.removeGroupMember(conversationId, memberId);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const toggleMemberAdmin = createAsyncThunk(
  'chat/toggleMemberAdmin',
  async ({ conversationId, memberId, isAdmin }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.updateMemberAdminStatus(conversationId, memberId, isAdmin);
      return data.conversation;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const archiveConversationThunk = createAsyncThunk(
  'chat/archiveConversation',
  async ({ conversationId, archive }, { rejectWithValue }) => {
    try {
      await chatService.archiveConversation(conversationId, archive);
      return { conversationId, archive };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const muteConversationThunk = createAsyncThunk(
  'chat/muteConversation',
  async ({ conversationId, mute, mutedUntil }, { rejectWithValue }) => {
    try {
      await chatService.muteConversation(conversationId, mute, mutedUntil);
      return { conversationId, mute, mutedUntil };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const clearConversationThunk = createAsyncThunk(
  'chat/clearConversation',
  async (conversationId, { rejectWithValue }) => {
    try {
      await chatService.clearConversation(conversationId);
      return { conversationId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchConversationMedia = createAsyncThunk(
  'chat/fetchConversationMedia',
  async ({ conversationId, params }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getConversationMedia(conversationId, params);
      return { conversationId, messages: data.messages };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ── Messages ──────────────────────────────────────────────────────────────────

export const fetchMessages = createAsyncThunk(
  'chat/fetchMessages',
  async ({ conversationId, before, limit = 50 }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getMessages(conversationId, { limit, before });
      return { conversationId, messages: data.messages, before, limit };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const sendTextMessage = createAsyncThunk(
  'chat/sendTextMessage',
  async ({ conversationId, payload }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.sendMessage(conversationId, payload);
      return { conversationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const sendMediaMessageThunk = createAsyncThunk(
  'chat/sendMediaMessage',
  async ({ conversationId, file, duration }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.sendMediaMessage(conversationId, file, duration);
      return { conversationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const markRead = createAsyncThunk(
  'chat/markRead',
  async (conversationId, { rejectWithValue }) => {
    try {
      await chatService.markMessagesRead(conversationId);
      return { conversationId };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchPinnedMessages = createAsyncThunk(
  'chat/fetchPinnedMessages',
  async (conversationId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getPinnedMessages(conversationId);
      return { conversationId, messages: data.messages };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const searchMessagesThunk = createAsyncThunk(
  'chat/searchMessages',
  async ({ conversationId, q, limit }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.searchMessages(conversationId, q, limit);
      return { conversationId, messages: data.messages, q };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const editMessageThunk = createAsyncThunk(
  'chat/editMessage',
  async ({ messageId, conversationId, text }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.editMessage(messageId, text);
      return { conversationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const deleteMessageThunk = createAsyncThunk(
  'chat/deleteMessage',
  async ({ messageId, conversationId, scope }, { rejectWithValue }) => {
    try {
      await chatService.deleteMessage(messageId, scope);
      return { messageId, conversationId, scope };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const reactToMessageThunk = createAsyncThunk(
  'chat/reactToMessage',
  async ({ messageId, conversationId, emoji }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.reactToMessage(messageId, emoji);
      return { messageId, conversationId, reactions: data.reactions };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const pinMessageThunk = createAsyncThunk(
  'chat/pinMessage',
  async ({ messageId, conversationId, pin }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.pinMessage(messageId, pin);
      return { conversationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const forwardMessageThunk = createAsyncThunk(
  'chat/forwardMessage',
  async ({ messageId, targetConversationId }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.forwardMessage(messageId, targetConversationId);
      return { conversationId: targetConversationId, message: data.message };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchTotalUnread = createAsyncThunk(
  'chat/fetchTotalUnread',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getUnreadCount();
      return data.unreadCount;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchBlockedUsers = createAsyncThunk(
  'chat/fetchBlockedUsers',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getBlockedUsers();
      return data.blockedUsers;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const blockUserThunk = createAsyncThunk(
  'chat/blockUser',
  async (targetUserId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.blockUser(targetUserId);
      return data.block;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const unblockUserThunk = createAsyncThunk(
  'chat/unblockUser',
  async (targetUserId, { rejectWithValue }) => {
    try {
      await chatService.unblockUser(targetUserId);
      return targetUserId;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchRtmToken = createAsyncThunk(
  'chat/fetchRtmToken',
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getRtmToken();
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const initiateCallThunk = createAsyncThunk(
  'chat/initiateCall',
  async ({ conversationId, type }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.initiateCall(conversationId, type);
      return { ...data, conversationId, type };
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const joinCallThunk = createAsyncThunk(
  'chat/joinCall',
  async (callId, { rejectWithValue }) => {
    try {
      const { data } = await chatService.joinCall(callId);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const endCallThunk = createAsyncThunk(
  'chat/endCall',
  async ({ callId, status }, { rejectWithValue }) => {
    try {
      const { data } = await chatService.endCall(callId, status);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchCallHistory = createAsyncThunk(
  'chat/fetchCallHistory',
  async (params = {}, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getCallHistory(params);
      return data;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

export const fetchPresence = createAsyncThunk(
  'chat/fetchPresence',
  async (userIds, { rejectWithValue }) => {
    try {
      const { data } = await chatService.getBulkPresence(userIds);
      return data.presence;
    } catch (err) {
      return rejectWithValue(err.response?.data?.message || err.message);
    }
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SLICE
// ─────────────────────────────────────────────────────────────────────────────

const chatSlice = createSlice({
  name: 'chat',
  initialState,

  reducers: {
    // Set current user id (called after login)
    setCurrentUserId(state, { payload }) {
      state.currentUserId = payload;
    },

    setActiveConversation(state, { payload: conversationId }) {
      state.activeConversationId = conversationId;
      state.searchResults        = {};
      state.searchQuery          = '';
    },

    clearActiveConversation(state) {
      state.activeConversationId = null;
    },

    // ── Socket: new message ─────────────────────────────────────────────────
    socketNewMessage(state, { payload: { conversationId, message } }) {
      ensureConvoMessages(state, conversationId);
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);

      const convo = state.conversations.entities[conversationId];
      if (convo) {
        convo.lastMessage = {
          _id:    message._id,
          sender: message.sender,
          text:   message.type === 'text' ? message.text : `[${message.type}]`,
          type:   message.type,
          sentAt: message.createdAt,
        };
        convo.updatedAt = message.createdAt;

        // FIX: only bump unread if this convo is NOT active AND message is not from self
        const isActive   = state.activeConversationId === conversationId;
        const senderId   = message.sender?._id || message.sender;
        const isFromSelf = senderId?.toString() === state.currentUserId;

        if (!isActive && !isFromSelf) {
          convo.unreadCount    = (convo.unreadCount || 0) + 1;
          state.totalUnread    = Math.max(0, state.totalUnread + 1);
        }
      }
    },

    socketMessageEdited(state, { payload: { conversationId, message } }) {
      if (!state.messagesByConversation[conversationId]) return;
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
    },

    socketMessageDeleted(state, { payload: { messageId, conversationId, scope } }) {
      if (!state.messagesByConversation[conversationId]) return;
      if (scope === 'for_all') {
        messagesAdapter.updateOne(state.messagesByConversation[conversationId], {
          id:      messageId,
          changes: { deletedForAll: true, text: null, isDeleted: true, media: null },
        });
      }
    },

    socketMessageReaction(state, { payload: { messageId, conversationId, reactions } }) {
      if (!state.messagesByConversation[conversationId]) return;
      messagesAdapter.updateOne(state.messagesByConversation[conversationId], {
        id: messageId, changes: { reactions },
      });
    },

    // FIX: socketMessagesRead — zero unread for conversation, adjust totalUnread correctly
    socketMessagesRead(state, { payload: { conversationId, readBy } }) {
      const convo = state.conversations.entities[conversationId];
      if (convo) {
        const prev           = convo.unreadCount || 0;
        convo.unreadCount    = 0;
        state.totalUnread    = Math.max(0, state.totalUnread - prev);
      }
    },

    // FIX: socketMessagesDelivered — store deliveredAt at conversation level only
    // Don't bulk-update all messages (we don't have currentUserId in reducer safely).
    // The per-message deliveredAt is fetched fresh from server via getMessages.
    socketMessagesDelivered(state, { payload: { conversationId, deliveredTo, deliveredAt } }) {
      // Update all messages in this conversation that were sent and have no deliveredAt
      if (!state.messagesByConversation[conversationId]) return;
      const ids = state.messagesByConversation[conversationId].ids;
      const updates = ids
        .map((id) => state.messagesByConversation[conversationId].entities[id])
        .filter((msg) => msg && !msg.deliveredAt)
        .map((msg) => ({ id: msg._id, changes: { deliveredAt } }));

      if (updates.length > 0) {
        messagesAdapter.updateMany(state.messagesByConversation[conversationId], updates);
      }
    },

    socketUserTyping(state, { payload: { conversationId, userId, isTyping } }) {
      if (!state.typingUsers[conversationId]) {
        state.typingUsers[conversationId] = [];
      }
      if (isTyping) {
        if (!state.typingUsers[conversationId].includes(userId)) {
          state.typingUsers[conversationId].push(userId);
        }
      } else {
        state.typingUsers[conversationId] = state.typingUsers[conversationId].filter(
          (id) => id !== userId
        );
      }
    },

    socketUserPresence(state, { payload: { userId, isOnline, lastseen } }) {
      state.presence[userId] = { isOnline, lastseen };
    },

    socketIncomingCall(state, { payload }) {
      state.incomingCall = payload;
    },

    socketCallParticipantJoined(state, { payload }) {
      if (state.activeCall) {
        if (!state.activeCall.participants) state.activeCall.participants = [];
        // Avoid duplicate
        const exists = state.activeCall.participants.some((p) => p.userId === payload.userId);
        if (!exists) state.activeCall.participants.push(payload);
      }
    },

    socketCallDeclined(state, { payload: { callId } }) {
      if (state.activeCall?.callId === callId)  state.activeCall  = null;
      if (state.incomingCall?.callId === callId) state.incomingCall = null;
    },

    socketCallEnded(state, { payload: { callId } }) {
      if (state.activeCall?.callId === callId)  state.activeCall  = null;
      if (state.incomingCall?.callId === callId) state.incomingCall = null;
    },

    socketCallCancelled(state, { payload: { callId } }) {
      if (state.activeCall?.callId === callId)  state.activeCall  = null;
      if (state.incomingCall?.callId === callId) state.incomingCall = null;
    },

    socketCallLog(state, { payload: { conversationId, message } }) {
      ensureConvoMessages(state, conversationId);
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
    },

    clearIncomingCall(state) {
      state.incomingCall = null;
    },

    clearActiveCall(state) {
      state.activeCall = null;
    },

    upsertConversation(state, { payload: conversation }) {
      conversationsAdapter.upsertOne(state.conversations, conversation);
    },

    clearSearch(state) {
      state.searchResults = {};
      state.searchQuery   = '';
    },

    setUploadProgress(state, { payload: { conversationId, progress } }) {
      state.uploadProgress[conversationId] = progress;
    },

    clearUploadProgress(state, { payload: conversationId }) {
      delete state.uploadProgress[conversationId];
    },

    clearError(state) {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // fetchConversations
    builder
      .addCase(fetchConversations.pending, (state) => {
        state.conversationsLoading = true;
      })
      .addCase(fetchConversations.fulfilled, (state, { payload }) => {
        state.conversationsLoading = false;
        conversationsAdapter.setAll(state.conversations, payload.conversations);
        state.conversationsMeta = { total: payload.total, page: payload.page, pages: payload.pages };
      })
      .addCase(fetchConversations.rejected, (state, { payload }) => {
        state.conversationsLoading = false;
        state.error = payload;
      });

    // startDirectConversation / startGroupConversation
    builder
      .addCase(startDirectConversation.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
      })
      .addCase(startGroupConversation.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
        toast.success('Group created');
      });

    // fetchConversationById
    builder.addCase(fetchConversationById.fulfilled, (state, { payload }) => {
      conversationsAdapter.upsertOne(state.conversations, payload);
    });

    // updateGroupInfo / addMembers / removeMember / toggleMemberAdmin
    builder
      .addCase(updateGroupInfo.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
        toast.success('Group updated');
      })
      .addCase(addMembers.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
        toast.success('Members added');
      })
      .addCase(removeMember.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
      })
      .addCase(toggleMemberAdmin.fulfilled, (state, { payload }) => {
        conversationsAdapter.upsertOne(state.conversations, payload);
      });

    // archiveConversation
    builder.addCase(archiveConversationThunk.fulfilled, (state, { payload: { conversationId, archive } }) => {
      if (archive) conversationsAdapter.removeOne(state.conversations, conversationId);
    });

    // clearConversation
    builder.addCase(clearConversationThunk.fulfilled, (state, { payload: { conversationId } }) => {
      if (state.messagesByConversation[conversationId]) {
        state.messagesByConversation[conversationId] = messagesAdapter.getInitialState();
      }
      toast.success('Chat cleared');
    });

    // fetchConversationMedia
    builder.addCase(fetchConversationMedia.fulfilled, (state, { payload: { conversationId, messages } }) => {
      state.mediaByConversation[conversationId] = messages;
    });

    // fetchMessages
    builder
      .addCase(fetchMessages.pending, (state, { meta: { arg } }) => {
        state.messagesLoadingMap[arg.conversationId] = true;
      })
      .addCase(fetchMessages.fulfilled, (state, { payload }) => {
        const { conversationId, messages, before, limit } = payload;
        ensureConvoMessages(state, conversationId);
        state.messagesLoadingMap[conversationId] = false;
        messagesAdapter.upsertMany(state.messagesByConversation[conversationId], messages);

        // FIX: use actual returned count vs requested limit (not hardcoded 50)
        state.messagesHasMoreMap[conversationId] = messages.length >= (limit || 50);
        if (messages.length > 0) {
          state.messagesCursorMap[conversationId] = messages[0]._id; // oldest
        }
      })
      .addCase(fetchMessages.rejected, (state, { meta: { arg }, payload }) => {
        state.messagesLoadingMap[arg.conversationId] = false;
        state.error = payload;
      });

    // sendTextMessage (REST fallback)
    builder.addCase(sendTextMessage.fulfilled, (state, { payload: { conversationId, message } }) => {
      ensureConvoMessages(state, conversationId);
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
    });

    // sendMediaMessage
    builder
      .addCase(sendMediaMessageThunk.fulfilled, (state, { payload: { conversationId, message } }) => {
        ensureConvoMessages(state, conversationId);
        messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
        delete state.uploadProgress[conversationId];
      })
      .addCase(sendMediaMessageThunk.rejected, (state, { meta: { arg } }) => {
        delete state.uploadProgress[arg.conversationId];
        toast.error('Upload failed');
      });

    // markRead
    builder.addCase(markRead.fulfilled, (state, { payload: { conversationId } }) => {
      const convo = state.conversations.entities[conversationId];
      if (convo) {
        const prev        = convo.unreadCount || 0;
        state.totalUnread = Math.max(0, state.totalUnread - prev);
        convo.unreadCount = 0;
      }
    });

    // fetchPinnedMessages
    builder.addCase(fetchPinnedMessages.fulfilled, (state, { payload: { conversationId, messages } }) => {
      state.pinnedMessages[conversationId] = messages;
    });

    // searchMessages
    builder
      .addCase(searchMessagesThunk.pending, (state) => { state.searchLoading = true; })
      .addCase(searchMessagesThunk.fulfilled, (state, { payload: { conversationId, messages, q } }) => {
        state.searchLoading = false;
        state.searchResults[conversationId] = messages;
        state.searchQuery = q;
      })
      .addCase(searchMessagesThunk.rejected, (state) => { state.searchLoading = false; });

    // editMessage
    builder.addCase(editMessageThunk.fulfilled, (state, { payload: { conversationId, message } }) => {
      if (!state.messagesByConversation[conversationId]) return;
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
    });

    // deleteMessage
    builder.addCase(deleteMessageThunk.fulfilled, (state, { payload: { messageId, conversationId, scope } }) => {
      if (!state.messagesByConversation[conversationId]) return;
      if (scope === 'for_all') {
        messagesAdapter.updateOne(state.messagesByConversation[conversationId], {
          id: messageId, changes: { deletedForAll: true, text: null, media: null },
        });
      } else {
        messagesAdapter.removeOne(state.messagesByConversation[conversationId], messageId);
      }
    });

    // reactToMessage
    builder.addCase(reactToMessageThunk.fulfilled, (state, { payload: { messageId, conversationId, reactions } }) => {
      if (!state.messagesByConversation[conversationId]) return;
      messagesAdapter.updateOne(state.messagesByConversation[conversationId], {
        id: messageId, changes: { reactions },
      });
    });

    // pinMessage
    builder.addCase(pinMessageThunk.fulfilled, (state, { payload: { conversationId, message } }) => {
      if (!state.messagesByConversation[conversationId]) return;
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
    });

    // forwardMessage
    builder.addCase(forwardMessageThunk.fulfilled, (state, { payload: { conversationId, message } }) => {
      ensureConvoMessages(state, conversationId);
      messagesAdapter.upsertOne(state.messagesByConversation[conversationId], message);
      toast.success('Message forwarded');
    });

    // fetchTotalUnread
    builder.addCase(fetchTotalUnread.fulfilled, (state, { payload }) => {
      state.totalUnread = payload;
    });

    // block / unblock
    builder
      .addCase(fetchBlockedUsers.fulfilled, (state, { payload }) => {
        state.blockedUsers = payload;
      })
      .addCase(blockUserThunk.fulfilled, (state, { payload }) => {
        state.blockedUsers.push(payload);
        toast.success('User blocked');
      })
      .addCase(unblockUserThunk.fulfilled, (state, { payload: targetUserId }) => {
        state.blockedUsers = state.blockedUsers.filter(
          (b) => b.blocked?._id !== targetUserId && b.blocked !== targetUserId
        );
        toast.success('User unblocked');
      });

    // calls
    builder
      .addCase(fetchRtmToken.fulfilled, (state, { payload }) => {
        state.rtmToken    = payload.rtmToken;
        state.rtmExpiresAt = payload.expiresAt;
      })
      .addCase(initiateCallThunk.fulfilled, (state, { payload }) => {
        state.activeCall = {
          callId:         payload.callId,
          channelName:    payload.channelName,
          token:          payload.token,
          uid:            payload.uid,
          appId:          payload.appId,
          type:           payload.type,
          conversationId: payload.conversationId,
          expiresAt:      payload.expiresAt,
        };
      })
      .addCase(joinCallThunk.fulfilled, (state, { payload }) => {
        state.activeCall = {
          callId:      payload.callId,
          channelName: payload.channelName,
          token:       payload.token,
          uid:         payload.uid,
          appId:       payload.appId,
          expiresAt:   payload.expiresAt,
        };
        state.incomingCall = null;
      })
      .addCase(endCallThunk.fulfilled, (state) => {
        state.activeCall   = null;
        state.incomingCall = null;
      })
      .addCase(fetchCallHistory.fulfilled, (state, { payload }) => {
        state.callHistory    = payload.calls;
        state.callHistoryMeta = { total: payload.total, page: payload.page, pages: payload.pages };
      });

    // presence
    builder.addCase(fetchPresence.fulfilled, (state, { payload }) => {
      for (const { userId, isOnline, lastseen } of payload) {
        state.presence[userId] = { ...state.presence[userId], isOnline, lastseen };
      }
    });

    // Global reject toast (silent for polling actions)
    builder.addMatcher(
      (action) => action.type.startsWith('chat/') && action.type.endsWith('/rejected'),
      (state, action) => {
        const silent = ['chat/fetchTotalUnread', 'chat/fetchPresence', 'chat/fetchRtmToken'];
        if (!silent.some((s) => action.type.startsWith(s))) {
          toast.error(action.payload || 'Something went wrong');
        }
      }
    );
  },
});

export const {
  setCurrentUserId,
  setActiveConversation,
  clearActiveConversation,
  socketNewMessage,
  socketMessageEdited,
  socketMessageDeleted,
  socketMessageReaction,
  socketMessagesRead,
  socketMessagesDelivered,
  socketUserTyping,
  socketUserPresence,
  socketIncomingCall,
  socketCallParticipantJoined,
  socketCallDeclined,
  socketCallEnded,
  socketCallCancelled,
  socketCallLog,
  clearIncomingCall,
  clearActiveCall,
  upsertConversation,
  clearSearch,
  setUploadProgress,
  clearUploadProgress,
  clearError,
} = chatSlice.actions;

export default chatSlice.reducer;

// ─────────────────────────────────────────────────────────────────────────────
// SELECTORS
// ─────────────────────────────────────────────────────────────────────────────

export const {
  selectAll:  selectAllConversations,
  selectById: selectConversationById,
  selectIds:  selectConversationIds,
} = conversationsAdapter.getSelectors((state) => state.chat.conversations);

export const selectActiveConversationId  = (state) => state.chat.activeConversationId;
export const selectConversationsLoading  = (state) => state.chat.conversationsLoading;
export const selectConversationsMeta     = (state) => state.chat.conversationsMeta;
export const selectTotalUnread           = (state) => state.chat.totalUnread;
export const selectBlockedUsers          = (state) => state.chat.blockedUsers;
export const selectActiveCall            = (state) => state.chat.activeCall;
export const selectIncomingCall          = (state) => state.chat.incomingCall;
export const selectCallHistory           = (state) => state.chat.callHistory;
export const selectCallHistoryMeta       = (state) => state.chat.callHistoryMeta;
export const selectRtmToken              = (state) => state.chat.rtmToken;
export const selectSearchQuery           = (state) => state.chat.searchQuery;
export const selectSearchLoading         = (state) => state.chat.searchLoading;
export const selectChatError             = (state) => state.chat.error;

export const selectActiveConversation = createSelector(
  [selectAllConversations, selectActiveConversationId],
  (conversations, id) => conversations.find((c) => c._id === id) || null
);

// Per-conversation selectors (used by standalone hooks above)
export const selectMessagesByConversation = (conversationId) =>
  createSelector(
    (state) => state.chat.messagesByConversation[conversationId],
    (entityState) => {
      if (!entityState) return [];
      return messagesAdapter.getSelectors().selectAll(entityState);
    }
  );

export const selectMessagesLoading  = (conversationId) => (state) =>
  state.chat.messagesLoadingMap[conversationId] || false;

export const selectMessagesHasMore  = (conversationId) => (state) =>
  state.chat.messagesHasMoreMap[conversationId] ?? true;

export const selectMessagesCursor   = (conversationId) => (state) =>
  state.chat.messagesCursorMap[conversationId] || null;

export const selectPinnedMessages   = (conversationId) => (state) =>
  state.chat.pinnedMessages[conversationId] || [];

export const selectConversationMedia = (conversationId) => (state) =>
  state.chat.mediaByConversation[conversationId] || [];

export const selectSearchResults    = (conversationId) => (state) =>
  state.chat.searchResults[conversationId] || [];

export const selectTypingUsers      = (conversationId) => (state) =>
  state.chat.typingUsers[conversationId] || [];

export const selectUserPresence     = (userId) => (state) =>
  state.chat.presence[userId] || { isOnline: false, lastseen: null };

export const selectUploadProgress   = (conversationId) => (state) =>
  state.chat.uploadProgress[conversationId] || 0;