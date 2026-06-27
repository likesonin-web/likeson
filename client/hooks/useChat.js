"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useChatSocket } from "@/context/SocketProvider";
import {
  fetchConversations,
  fetchMessages,
  sendTextMessage,
  sendMediaMessageThunk,
  markRead,
  markDeliveredThunk,
  fetchPinnedMessages,
  fetchTotalUnread,
  fetchPresence,
  fetchRtmToken,
  deleteMessageThunk,
  editMessageThunk,
  reactToMessageThunk,
  pinMessageThunk,
  forwardMessageThunk,
  archiveConversationThunk,
  muteConversationThunk,
  clearConversationThunk,
  fetchConversationMedia,
  addMembers,
  removeMember,
  toggleMemberAdmin,
  updateGroupInfo,
  startDirectConversation,
  startGroupConversation,
  startLinkedConversation,
  fetchRoleLinkedConversation,
  blockUserThunk,
  unblockUserThunk,
  setActiveConversation,
  clearActiveConversation,
  clearSearch,
  searchMessagesThunk,
  initiateCallThunk,
  joinCallThunk,
  endCallThunk,
  refreshCallTokenThunk,
  fetchConversationById,
  fetchBlockedUsers,
  fetchCallHistory,
  adminFetchConversationsThunk,
  adminFetchMessagesThunk,
  adminFetchCallsThunk,
  setCurrentUserId,
  clearCurrentUserId,
  socketNewMessage,
  // Selectors
  selectAllConversations,
  selectActiveConversationId,
  selectActiveConversation,
  selectConversationsLoading,
  selectConversationsMeta,
  selectMessagesByConversation,
  selectMessagesLoading,
  selectMessagesHasMore,
  selectTypingUsers,
  selectTotalUnread,
  selectActiveCall,
  selectIncomingCall,
  selectUserPresence,
  selectSearchResults,
  selectSearchLoading,
  selectSearchQuery,
  selectPinnedMessages,
  selectConversationMedia,
  selectUploadProgress,
  selectChatError,
  setUploadProgress,
  clearUploadProgress,
  selectBlockedUsers,
  selectCallHistory,
  selectCallHistoryMeta,
  selectRoleLinkedLoading,
  selectAdminConversations,
  selectAdminConversationsMeta,
  selectAdminCalls,
  selectAdminCallsMeta,
  selectAdminMessages,
  adminDeleteMessageThunk,
  blockConversationThunk,
  fetchSinglePresence,
  fetchCallThunk,
} from "@/store/slices/chatSlice";
import { selectCurrentUser } from "@/store/slices/userSlice";

// ═══════════════════════════════════════════════════════════════════
// PER-CONVERSATION HOOKS
// ═══════════════════════════════════════════════════════════════════

export const useConversationMessages = (conversationId) =>
  useSelector(selectMessagesByConversation(conversationId || ""));

export const useConversationMessagesLoading = (conversationId) =>
  useSelector(selectMessagesLoading(conversationId || ""));

export const useConversationHasMore = (conversationId) =>
  useSelector(selectMessagesHasMore(conversationId || ""));

export const useConversationTyping = (conversationId) =>
  useSelector(selectTypingUsers(conversationId || ""));

export const useConversationPinned = (conversationId) =>
  useSelector(selectPinnedMessages(conversationId || ""));

export const useConversationMedia = (conversationId) =>
  useSelector(selectConversationMedia(conversationId || ""));

export const useConversationSearchResults = (conversationId) =>
  useSelector(selectSearchResults(conversationId || ""));

export const useConversationUploadProgress = (conversationId) =>
  useSelector(selectUploadProgress(conversationId || ""));

export const useUserPresence = (userId) =>
  useSelector(selectUserPresence(userId || ""));

export const useAdminMessages = (conversationId) =>
  useSelector(selectAdminMessages(conversationId || ""));

// ═══════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═══════════════════════════════════════════════════════════════════

export function useChat() {
  const dispatch = useDispatch();
  const socket = useChatSocket();
  const currentUser = useSelector(selectCurrentUser);
  const typingTimerRef = useRef({});

  const conversations = useSelector(selectAllConversations);
  const conversationsLoading = useSelector(selectConversationsLoading);
  const conversationsMeta = useSelector(selectConversationsMeta);
  const activeConversationId = useSelector(selectActiveConversationId);
  const activeConversation = useSelector(selectActiveConversation);
  const totalUnread = useSelector(selectTotalUnread);
  const blockedUsers = useSelector(selectBlockedUsers);
  const activeCall = useSelector(selectActiveCall);
  const incomingCall = useSelector(selectIncomingCall);
  const callHistory = useSelector(selectCallHistory);
  const callHistoryMeta = useSelector(selectCallHistoryMeta);
  const searchQuery = useSelector(selectSearchQuery);
  const searchLoading = useSelector(selectSearchLoading);
  const error = useSelector(selectChatError);
  const roleLinkedLoading = useSelector(selectRoleLinkedLoading);
  const adminConversations = useSelector(selectAdminConversations);
  const adminConversationsMeta = useSelector(selectAdminConversationsMeta);
  const adminCalls = useSelector(selectAdminCalls);
  const adminCallsMeta = useSelector(selectAdminCallsMeta);

  // ── Init ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?._id) {
      dispatch(clearCurrentUserId());
      return;
    }
    dispatch(setCurrentUserId(currentUser._id));
    dispatch(fetchConversations());
    dispatch(fetchTotalUnread());
    dispatch(fetchRtmToken());
  }, [dispatch, currentUser?._id]);

  // ── Load messages + mark read when active conversation changes ────
  useEffect(() => {
    if (!activeConversationId) return;
    dispatch(fetchMessages({ conversationId: activeConversationId, limit: 50 }));
    dispatch(markRead(activeConversationId));
  }, [activeConversationId, dispatch]);

  // ── Join/leave socket room ────────────────────────────────────────
  useEffect(() => {
    if (!activeConversationId || !socket?.connected) return;
    socket.joinConversation(activeConversationId);
    return () => { socket.leaveConversation(activeConversationId); };
  }, [activeConversationId, socket?.connected, socket]);

  // ── Fetch presence for active conversation participants ────────────
  const participantKey = useMemo(() => {
    if (!activeConversation?.participants?.length) return "";
    return activeConversation.participants
      .map((p) => (p.user?._id || p.user)?.toString())
      .filter(Boolean)
      .sort()
      .join(",");
  }, [activeConversation?.participants]);

  useEffect(() => {
    if (!participantKey) return;
    const ids = participantKey.split(",");
    if (ids.length) dispatch(fetchPresence(ids));
  }, [participantKey, dispatch]);

  // ═══════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════

  const selectConversation = useCallback(
    (conversationId) => dispatch(setActiveConversation(conversationId)),
    [dispatch],
  );

  const closeConversation = useCallback(
    () => dispatch(clearActiveConversation()),
    [dispatch],
  );

  const loadConversationById = useCallback(
    (conversationId) => dispatch(fetchConversationById(conversationId)).unwrap(),
    [dispatch],
  );

  const loadMoreMessages = useCallback(
    (conversationId, oldestMessageId) =>
      dispatch(fetchMessages({ conversationId, before: oldestMessageId, limit: 50 })),
    [dispatch],
  );

  const sendMessage = useCallback(
    async (conversationId, payload) => {
      if (socket?.connected) {
        return socket.sendMessage(conversationId, payload);
      }
      return dispatch(sendTextMessage({ conversationId, payload })).unwrap();
    },
    [dispatch, socket],
  );

  // FIX: after REST upload, manually dispatch socketNewMessage so receiver
  // sees it immediately via Redux without refresh.
  const sendMedia = useCallback(
    async (conversationId, file, duration) => {
      dispatch(setUploadProgress({ conversationId, progress: 15 }));
      try {
        const message = await dispatch(
          sendMediaMessageThunk({ conversationId, file, duration }),
        ).unwrap();
        // Optimistically push to sender's own message list (thunk already does
        // this via extraReducers), but we also re-emit as socketNewMessage so
        // any OTHER open tab / participant who is watching gets the live update.
        // The socket server does the real broadcast; this handles the REST path.
        dispatch(socketNewMessage({ conversationId, message }));
        return message;
      } finally {
        dispatch(clearUploadProgress(conversationId));
      }
    },
    [dispatch],
  );

  const deleteMessage = useCallback(
    (messageId, conversationId, scope = "for_me") => {
      if (socket?.connected && scope === "for_all") {
        return socket.deleteMessage(messageId, scope);
      }
      return dispatch(deleteMessageThunk({ messageId, conversationId, scope })).unwrap();
    },
    [dispatch, socket],
  );

  const editMessage = useCallback(
    (messageId, conversationId, text) => {
      if (socket?.connected) return socket.editMessage(messageId, text);
      return dispatch(editMessageThunk({ messageId, conversationId, text })).unwrap();
    },
    [dispatch, socket],
  );

  const reactToMessage = useCallback(
    (messageId, conversationId, emoji) => {
      if (socket?.connected) return socket.reactMessage(messageId, emoji);
      return dispatch(reactToMessageThunk({ messageId, conversationId, emoji })).unwrap();
    },
    [dispatch, socket],
  );

  const pinMessage = useCallback(
    (messageId, conversationId, pin) =>
      dispatch(pinMessageThunk({ messageId, conversationId, pin })).unwrap(),
    [dispatch],
  );

  const forwardMessage = useCallback(
    (messageId, targetConversationId) =>
      dispatch(forwardMessageThunk({ messageId, targetConversationId })).unwrap(),
    [dispatch],
  );

  const markAsRead = useCallback(
    (conversationId) => {
      dispatch(markRead(conversationId));
      socket?.markRead(conversationId);
    },
    [dispatch, socket],
  );

  const markAsDelivered = useCallback(
    (conversationId) => dispatch(markDeliveredThunk(conversationId)).unwrap(),
    [dispatch],
  );

  // Typing — debounce auto-stop after 3s
  const sendTyping = useCallback(
    (conversationId, isTyping) => {
      socket?.sendTyping(conversationId, isTyping);
      if (isTyping) {
        const key = `typing_${conversationId}`;
        if (typingTimerRef.current[key]) clearTimeout(typingTimerRef.current[key]);
        typingTimerRef.current[key] = setTimeout(() => {
          socket?.sendTyping(conversationId, false);
          delete typingTimerRef.current[key];
        }, 3000);
      }
    },
    [socket],
  );

  useEffect(() => {
    const timers = typingTimerRef.current;
    return () => { Object.values(timers).forEach(clearTimeout); };
  }, []);

  const archiveConversation = useCallback(
    (conversationId, archive = true) =>
      dispatch(archiveConversationThunk({ conversationId, archive })).unwrap(),
    [dispatch],
  );

  const muteConversation = useCallback(
    (conversationId, mute = true, mutedUntil = null) =>
      dispatch(muteConversationThunk({ conversationId, mute, mutedUntil })).unwrap(),
    [dispatch],
  );

  const clearConversation = useCallback(
    (conversationId) => dispatch(clearConversationThunk(conversationId)).unwrap(),
    [dispatch],
  );

  const loadMedia = useCallback(
    (conversationId, params) =>
      dispatch(fetchConversationMedia({ conversationId, params })).unwrap(),
    [dispatch],
  );

  const loadPinned = useCallback(
    (conversationId) => dispatch(fetchPinnedMessages(conversationId)).unwrap(),
    [dispatch],
  );

  const searchMessages = useCallback(
    (conversationId, q) =>
      dispatch(searchMessagesThunk({ conversationId, q })).unwrap(),
    [dispatch],
  );

  const clearSearchResults = useCallback(() => dispatch(clearSearch()), [dispatch]);

  const addGroupMembers = useCallback(
    (conversationId, memberIds) =>
      dispatch(addMembers({ conversationId, memberIds })).unwrap(),
    [dispatch],
  );

  const removeGroupMember = useCallback(
    (conversationId, memberId) =>
      dispatch(removeMember({ conversationId, memberId })).unwrap(),
    [dispatch],
  );

  const toggleAdmin = useCallback(
    (conversationId, memberId, isAdmin) =>
      dispatch(toggleMemberAdmin({ conversationId, memberId, isAdmin })).unwrap(),
    [dispatch],
  );

  const updateGroup = useCallback(
    (conversationId, payload) =>
      dispatch(updateGroupInfo({ conversationId, payload })).unwrap(),
    [dispatch],
  );

  const startDM = useCallback(
    (targetUserId) => dispatch(startDirectConversation(targetUserId)).unwrap(),
    [dispatch],
  );

  const startGroup = useCallback(
    (payload) => dispatch(startGroupConversation(payload)).unwrap(),
    [dispatch],
  );

  const startLinkedGroup = useCallback(
    (payload) => dispatch(startLinkedConversation(payload)).unwrap(),
    [dispatch],
  );

  const loadRoleLinkedConversation = useCallback(
    (type, id) => dispatch(fetchRoleLinkedConversation({ type, id })).unwrap(),
    [dispatch],
  );

  const loadBlockedUsers = useCallback(
    () => dispatch(fetchBlockedUsers()).unwrap(),
    [dispatch],
  );

  const blockUser = useCallback(
    (targetUserId) => dispatch(blockUserThunk(targetUserId)).unwrap(),
    [dispatch],
  );

  const unblockUser = useCallback(
    (targetUserId) => dispatch(unblockUserThunk(targetUserId)).unwrap(),
    [dispatch],
  );

  const adminDeleteMessage = useCallback(
    (messageId, conversationId) =>
      dispatch(adminDeleteMessageThunk({ messageId, conversationId })).unwrap(),
    [dispatch],
  );

  const blockConversation = useCallback(
    (conversationId) => dispatch(blockConversationThunk(conversationId)).unwrap(),
    [dispatch],
  );

  const loadSinglePresence = useCallback(
    (userId) => dispatch(fetchSinglePresence(userId)).unwrap(),
    [dispatch],
  );

  const loadCall = useCallback(
    (callId) => dispatch(fetchCallThunk(callId)).unwrap(),
    [dispatch],
  );

  // ── Calls ─────────────────────────────────────────────────────────

const initiateCall = useCallback(
  async (conversationId, type = 'audio') => {
    try {
      if (socket?.connected) {
        return await socket.initiateCall(conversationId, type);
      }
      return await dispatch(initiateCallThunk({ conversationId, type })).unwrap();
    } catch (err) {
      const msg = typeof err === 'string' ? err : (err?.message ?? '');
      if (msg.toLowerCase().includes('already active')) {
        // Another call is live — fetch conversation to get its callId, then join
        const convo = await dispatch(fetchConversationById(conversationId)).unwrap();
        const callId = convo?.activeCall?.callId;
        if (!callId) throw new Error('Call active but no callId found on conversation');
        // joinCallThunk sets activeCall in Redux → CallModal opens
        return dispatch(joinCallThunk(callId)).unwrap();
      }
      throw err;
    }
  },
  [dispatch, socket],
);

  const joinCall = useCallback(
    (callId) => {
      if (socket?.connected) return socket.joinCall(callId);
      return dispatch(joinCallThunk(callId)).unwrap();
    },
    [dispatch, socket],
  );

  const declineCall = useCallback(
    (callId) => socket?.declineCall(callId),
    [socket],
  );

  const endCall = useCallback(
    (callId) => {
      if (socket?.connected) return socket.endCall(callId);
      return dispatch(endCallThunk({ callId, status: "ended" })).unwrap();
    },
    [dispatch, socket],
  );

  const cancelCall = useCallback(
    (callId) => socket?.cancelCall(callId),
    [socket],
  );

  const sendMuteState = useCallback(
    (callId, isMuted, isCamOff) => socket?.sendMuteState(callId, isMuted, isCamOff),
    [socket],
  );

  const renewCallToken = useCallback(
    (callId) => {
      if (socket?.connected && socket.renewCallToken) return socket.renewCallToken(callId);
      return dispatch(refreshCallTokenThunk(callId)).unwrap();
    },
    [dispatch, socket],
  );

  const loadCallHistory = useCallback(
    (params = {}) => dispatch(fetchCallHistory(params)).unwrap(),
    [dispatch],
  );

  // ── Admin ─────────────────────────────────────────────────────────

  const loadAdminConversations = useCallback(
    (params = {}) => dispatch(adminFetchConversationsThunk(params)).unwrap(),
    [dispatch],
  );

  const loadAdminMessages = useCallback(
    (conversationId, params = {}) =>
      dispatch(adminFetchMessagesThunk({ conversationId, params })).unwrap(),
    [dispatch],
  );

  const loadAdminCalls = useCallback(
    (params = {}) => dispatch(adminFetchCallsThunk(params)).unwrap(),
    [dispatch],
  );

  return {
    conversations,
    conversationsLoading,
    conversationsMeta,
    activeConversationId,
    activeConversation,
    totalUnread,
    blockedUsers,
    activeCall,
    incomingCall,
    callHistory,
    callHistoryMeta,
    searchQuery,
    searchLoading,
    error,
    currentUser,
    socket,
    roleLinkedLoading,
    adminConversations,
    adminConversationsMeta,
    adminCalls,
    adminCallsMeta,

    adminDeleteMessage,
    blockConversation,
    loadSinglePresence,
    loadCall,

    selectConversation,
    closeConversation,
    loadConversationById,
    loadMoreMessages,
    markAsRead,
    markAsDelivered,
    archiveConversation,
    muteConversation,
    clearConversation,
    loadMedia,
    loadPinned,
    startDM,
    startGroup,
    startLinkedGroup,
    loadRoleLinkedConversation,

    sendMessage,
    sendMedia,
    deleteMessage,
    editMessage,
    reactToMessage,
    pinMessage,
    forwardMessage,
    sendTyping,
    searchMessages,
    clearSearchResults,

    addGroupMembers,
    removeGroupMember,
    toggleAdmin,
    updateGroup,

    loadBlockedUsers,
    blockUser,
    unblockUser,

    initiateCall,
    joinCall,
    declineCall,
    endCall,
    cancelCall,
    sendMuteState,
    renewCallToken,
    loadCallHistory,

    loadAdminConversations,
    loadAdminMessages,
    loadAdminCalls,
  };
}

export default useChat;
