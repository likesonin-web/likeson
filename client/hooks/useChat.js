'use client';
/**
 * hooks/useChat.js
 * Fixes applied:
 * - CRITICAL: useMessages/useMessagesLoading/etc were hooks called INSIDE
 * regular functions returned from useChat() — this violates Rules of Hooks.
 * Fix: each per-conversation selector is now a standalone exported hook.
 * The page calls useConversationMessages(id) directly, not chat.useMessages(id).
 * - useChat() now returns flat stable values only (no hook-returning functions).
 * - All useCallback deps correctly listed.
 * - fetchPresence: only fetch when participant ids actually change (use JSON key).
 * - ADDED: missing thunks (fetchConversationById, fetchBlockedUsers, fetchCallHistory) 
 * and their corresponding state selectors for full slice coverage.
 */

import { useCallback, useEffect, useMemo, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useChatSocket } from '@/providers/ChatProvider';
import {
  fetchConversations,
  fetchMessages,
  sendTextMessage,
  sendMediaMessageThunk,
  markRead,
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
  blockUserThunk,
  unblockUserThunk,
  setActiveConversation,
  clearActiveConversation,
  clearSearch,
  searchMessagesThunk,
  initiateCallThunk,
  joinCallThunk,
  endCallThunk,
  // Added missing thunk imports
  fetchConversationById,
  fetchBlockedUsers,
  fetchCallHistory,
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
  // Added missing selector imports
  selectBlockedUsers,
  selectCallHistory,
  selectCallHistoryMeta,
} from '@/store/slices/chatSlice';
import { selectCurrentUser } from '@/store/slices/userSlice';

// ═════════════════════════════════════════════════════════════════════════════
// PER-CONVERSATION HOOKS  (call these directly in components, not via useChat)
// ═════════════════════════════════════════════════════════════════════════════

/** Returns sorted messages array for a conversation */
export const useConversationMessages = (conversationId) =>
  useSelector(selectMessagesByConversation(conversationId || ''));

/** Returns loading bool for a conversation's messages */
export const useConversationMessagesLoading = (conversationId) =>
  useSelector(selectMessagesLoading(conversationId || ''));

/** Returns hasMore bool for a conversation */
export const useConversationHasMore = (conversationId) =>
  useSelector(selectMessagesHasMore(conversationId || ''));

/** Returns typing user ids for a conversation */
export const useConversationTyping = (conversationId) =>
  useSelector(selectTypingUsers(conversationId || ''));

/** Returns pinned messages for a conversation */
export const useConversationPinned = (conversationId) =>
  useSelector(selectPinnedMessages(conversationId || ''));

/** Returns media messages for a conversation */
export const useConversationMedia = (conversationId) =>
  useSelector(selectConversationMedia(conversationId || ''));

/** Returns search results for a conversation */
export const useConversationSearchResults = (conversationId) =>
  useSelector(selectSearchResults(conversationId || ''));

/** Returns upload progress 0-100 for a conversation */
export const useConversationUploadProgress = (conversationId) =>
  useSelector(selectUploadProgress(conversationId || ''));

/** Returns presence for a user */
export const useUserPresence = (userId) =>
  useSelector(selectUserPresence(userId || ''));

// ═════════════════════════════════════════════════════════════════════════════
// MAIN HOOK
// ═════════════════════════════════════════════════════════════════════════════

export function useChat() {
  const dispatch = useDispatch();
  const socket   = useChatSocket();
  const currentUser = useSelector(selectCurrentUser);
  const typingTimerRef = useRef({});

  // ── Global selectors ───────────────────────────────────────────────────────
  const conversations        = useSelector(selectAllConversations);
  const conversationsLoading = useSelector(selectConversationsLoading);
  const conversationsMeta    = useSelector(selectConversationsMeta);
  const activeConversationId = useSelector(selectActiveConversationId);
  const activeConversation   = useSelector(selectActiveConversation);
  const totalUnread          = useSelector(selectTotalUnread);
  const blockedUsers         = useSelector(selectBlockedUsers);
  const activeCall           = useSelector(selectActiveCall);
  const incomingCall         = useSelector(selectIncomingCall);
  const callHistory          = useSelector(selectCallHistory);
  const callHistoryMeta      = useSelector(selectCallHistoryMeta);
  const searchQuery          = useSelector(selectSearchQuery);
  const searchLoading        = useSelector(selectSearchLoading);
  const error                = useSelector(selectChatError);

  // ── Init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?._id) return;
    dispatch(fetchConversations());
    dispatch(fetchTotalUnread());
    dispatch(fetchRtmToken());
  }, [dispatch, currentUser?._id]);

  // ── Auto-join active conversation socket room + load messages ──────────────
  useEffect(() => {
    if (!activeConversationId) return;
    if (socket?.connected) {
      socket.joinConversation(activeConversationId);
    }
    dispatch(fetchMessages({ conversationId: activeConversationId, limit: 50 }));
    dispatch(markRead(activeConversationId));

    return () => {
      if (socket?.connected) {
        socket.leaveConversation(activeConversationId);
      }
    };
  }, [activeConversationId, socket?.connected, dispatch]);

  // ── Fetch presence for active conversation participants ────────────────────
  const participantKey = useMemo(() => {
    if (!activeConversation?.participants?.length) return '';
    return activeConversation.participants
      .map((p) => (p.user?._id || p.user)?.toString())
      .filter(Boolean)
      .sort()
      .join(',');
  }, [activeConversation?.participants]);

  useEffect(() => {
    if (!participantKey) return;
    const ids = participantKey.split(',');
    if (ids.length) dispatch(fetchPresence(ids));
  }, [participantKey, dispatch]);

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════

  const selectConversation = useCallback(
    (conversationId) => dispatch(setActiveConversation(conversationId)),
    [dispatch]
  );

  const closeConversation = useCallback(
    () => dispatch(clearActiveConversation()),
    [dispatch]
  );

  const loadConversationById = useCallback(
    (conversationId) => dispatch(fetchConversationById(conversationId)).unwrap(),
    [dispatch]
  );

  const loadMoreMessages = useCallback(
    (conversationId, oldestMessageId) =>
      dispatch(fetchMessages({ conversationId, before: oldestMessageId, limit: 50 })),
    [dispatch]
  );

  const sendMessage = useCallback(
    async (conversationId, payload) => {
      if (socket?.connected) {
        return socket.sendMessage(conversationId, payload);
      }
      return dispatch(sendTextMessage({ conversationId, payload })).unwrap();
    },
    [dispatch, socket]
  );

  const sendMedia = useCallback(
    async (conversationId, file, duration) => {
      dispatch(setUploadProgress({ conversationId, progress: 10 }));
      try {
        const result = await dispatch(
          sendMediaMessageThunk({ conversationId, file, duration })
        ).unwrap();
        return result;
      } finally {
        // progress cleared in extraReducers on fulfilled/rejected
      }
    },
    [dispatch]
  );

  const deleteMessage = useCallback(
    (messageId, conversationId, scope = 'for_me') => {
      if (socket?.connected && scope === 'for_all') {
        return socket.deleteMessage(messageId, scope);
      }
      return dispatch(deleteMessageThunk({ messageId, conversationId, scope })).unwrap();
    },
    [dispatch, socket]
  );

  const editMessage = useCallback(
    (messageId, conversationId, text) => {
      if (socket?.connected) return socket.editMessage(messageId, text);
      return dispatch(editMessageThunk({ messageId, conversationId, text })).unwrap();
    },
    [dispatch, socket]
  );

  const reactToMessage = useCallback(
    (messageId, conversationId, emoji) => {
      if (socket?.connected) return socket.reactMessage(messageId, emoji);
      return dispatch(reactToMessageThunk({ messageId, conversationId, emoji })).unwrap();
    },
    [dispatch, socket]
  );

  const pinMessage = useCallback(
    (messageId, conversationId, pin) =>
      dispatch(pinMessageThunk({ messageId, conversationId, pin })).unwrap(),
    [dispatch]
  );

  const forwardMessage = useCallback(
    (messageId, targetConversationId) =>
      dispatch(forwardMessageThunk({ messageId, targetConversationId })).unwrap(),
    [dispatch]
  );

  const markAsRead = useCallback(
    (conversationId) => {
      dispatch(markRead(conversationId));
      socket?.markRead(conversationId);
    },
    [dispatch, socket]
  );

  // Typing — debounce auto-stop after 3 s
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
    [socket]
  );

  const archiveConversation = useCallback(
    (conversationId, archive = true) =>
      dispatch(archiveConversationThunk({ conversationId, archive })).unwrap(),
    [dispatch]
  );

  const muteConversation = useCallback(
    (conversationId, mute = true, mutedUntil = null) =>
      dispatch(muteConversationThunk({ conversationId, mute, mutedUntil })).unwrap(),
    [dispatch]
  );

  const clearConversation = useCallback(
    (conversationId) =>
      dispatch(clearConversationThunk(conversationId)).unwrap(),
    [dispatch]
  );

  const loadMedia = useCallback(
    (conversationId, params) =>
      dispatch(fetchConversationMedia({ conversationId, params })).unwrap(),
    [dispatch]
  );

  const loadPinned = useCallback(
    (conversationId) => dispatch(fetchPinnedMessages(conversationId)).unwrap(),
    [dispatch]
  );

  const searchMessages = useCallback(
    (conversationId, q) =>
      dispatch(searchMessagesThunk({ conversationId, q })).unwrap(),
    [dispatch]
  );

  const clearSearchResults = useCallback(
    () => dispatch(clearSearch()),
    [dispatch]
  );

  const addGroupMembers = useCallback(
    (conversationId, memberIds) =>
      dispatch(addMembers({ conversationId, memberIds })).unwrap(),
    [dispatch]
  );

  const removeGroupMember = useCallback(
    (conversationId, memberId) =>
      dispatch(removeMember({ conversationId, memberId })).unwrap(),
    [dispatch]
  );

  const toggleAdmin = useCallback(
    (conversationId, memberId, isAdmin) =>
      dispatch(toggleMemberAdmin({ conversationId, memberId, isAdmin })).unwrap(),
    [dispatch]
  );

  const updateGroup = useCallback(
    (conversationId, payload) =>
      dispatch(updateGroupInfo({ conversationId, payload })).unwrap(),
    [dispatch]
  );

  const startDM = useCallback(
    (targetUserId) =>
      dispatch(startDirectConversation(targetUserId)).unwrap(),
    [dispatch]
  );

  const startGroup = useCallback(
    (payload) =>
      dispatch(startGroupConversation(payload)).unwrap(),
    [dispatch]
  );

  const loadBlockedUsers = useCallback(
    () => dispatch(fetchBlockedUsers()).unwrap(),
    [dispatch]
  );

  const blockUser = useCallback(
    (targetUserId) => dispatch(blockUserThunk(targetUserId)).unwrap(),
    [dispatch]
  );

  const unblockUser = useCallback(
    (targetUserId) => dispatch(unblockUserThunk(targetUserId)).unwrap(),
    [dispatch]
  );

  // ── Calls ──────────────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    (conversationId, type = 'audio') => {
      if (socket?.connected) return socket.initiateCall(conversationId, type);
      return dispatch(initiateCallThunk({ conversationId, type })).unwrap();
    },
    [dispatch, socket]
  );

  const joinCall = useCallback(
    (callId) => {
      if (socket?.connected) return socket.joinCall(callId);
      return dispatch(joinCallThunk(callId)).unwrap();
    },
    [dispatch, socket]
  );

  const declineCall = useCallback(
    (callId) => socket?.declineCall(callId),
    [socket]
  );

  const endCall = useCallback(
    (callId) => {
      if (socket?.connected) return socket.endCall(callId);
      return dispatch(endCallThunk({ callId, status: 'ended' })).unwrap();
    },
    [dispatch, socket]
  );

  const cancelCall = useCallback(
    (callId) => socket?.cancelCall(callId),
    [socket]
  );

  const sendMuteState = useCallback(
    (callId, isMuted, isCamOff) => socket?.sendMuteState(callId, isMuted, isCamOff),
    [socket]
  );

  const renewCallToken = useCallback(
    (callId) => socket?.renewCallToken(callId),
    [socket]
  );

  const loadCallHistory = useCallback(
    (params = {}) => dispatch(fetchCallHistory(params)).unwrap(),
    [dispatch]
  );

  return {
    // State
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

    // Conversation actions
    selectConversation,
    closeConversation,
    loadConversationById,
    loadMoreMessages,
    markAsRead,
    archiveConversation,
    muteConversation,
    clearConversation,
    loadMedia,
    loadPinned,
    startDM,
    startGroup,

    // Message actions
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

    // Group actions
    addGroupMembers,
    removeGroupMember,
    toggleAdmin,
    updateGroup,

    // User actions
    loadBlockedUsers,
    blockUser,
    unblockUser,

    // Call actions
    initiateCall,
    joinCall,
    declineCall,
    endCall,
    cancelCall,
    sendMuteState,
    renewCallToken,
    loadCallHistory,
  };
}

export default useChat;