'use client';

/**
 * @file useSocketChat.js
 * @desc Drop-in hook for ChatManagement.jsx
 *
 * Replaces the manual "Socket.IO wiring" comments in ChatManagement.
 *
 * HOW TO USE IN ChatManagement.jsx:
 *
 *   import { useSocketChat } from '@/hooks/useSocketChat';
 *
 *   export default function ChatManagement() {
 *     const dispatch    = useDispatch();
 *     const activeConv  = useSelector(selectActiveConversation);
 *     const currentUser = useSelector(state => state.user?.user);
 *
 *     // ← just add this one line (replaces the big comment block)
 *     const { typingUsers, onlineUsers, isConnected } = useSocketChat();
 *
 *     // ... rest of your component
 *   }
 *
 * HOW TO USE IN MessageInput.jsx (typing indicators):
 *
 *   const { emitTyping, emitStopTyping } = useSocketChat();
 *
 *   // Inside textarea onChange:
 *   onChange={e => { setText(e.target.value); emitTyping(convId); }}
 *   onBlur={() => emitStopTyping(convId)}
 *
 * HOW TO USE IN MessageBubble.jsx / after API calls:
 *
 *   const { emitNewMessage, emitMessageDeleted, emitReactionToggled } = useSocketChat();
 *
 *   // After sendMessage API success:
 *   emitNewMessage(serverMessage);
 *
 *   // After deleteMessage API success (for_everyone):
 *   emitMessageDeleted(conversationId, messageId, 'for_everyone');
 *
 *   // After reactToMessage API success:
 *   emitReactionToggled(conversationId, messageId, reactions);
 */

import { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSocket } from '@/providers/SocketProvider';
import {
  selectActiveConversation,
  markMessagesRead,
  resetUnread,
} from '@/store/slices/chatSlice';

export function useSocketChat() {
  const socket     = useSocket();
  const dispatch   = useDispatch();
  const activeConv = useSelector(selectActiveConversation);
  const currentUser = useSelector(state => state.user?.user);

  // ── Auto-join active conversation room whenever it changes ──────────────
  useEffect(() => {
    if (!socket.isConnected || !activeConv?._id) return;
    socket.joinConversation(activeConv._id);

    // Mark messages read when entering a conversation
    dispatch(markMessagesRead({ conversationId: activeConv._id }));
    dispatch(resetUnread({ conversationId: activeConv._id }));
    socket.emitMessagesRead(activeConv._id, currentUser?._id, null);
  }, [activeConv?._id, socket.isConnected]);

  // ── Typing wrapper that includes current convId automatically ───────────
  const emitTypingInActive = useCallback(() => {
    if (activeConv?._id) socket.emitTyping(activeConv._id);
  }, [activeConv?._id, socket.emitTyping]);

  const emitStopTypingInActive = useCallback(() => {
    if (activeConv?._id) socket.emitStopTyping(activeConv._id);
  }, [activeConv?._id, socket.emitStopTyping]);

  // ── Get typing user names for the active conversation ───────────────────
  const typingInActive = activeConv?._id
    ? (socket.typingUsers[activeConv._id] || [])
    : [];

  return {
    // Connection
    isConnected:    socket.isConnected,
    onlineUsers:    socket.onlineUsers,

    // Typing
    typingUsers:            socket.typingUsers,
    typingInActive,
    emitTyping:             socket.emitTyping,
    emitStopTyping:         socket.emitStopTyping,
    emitTypingInActive,
    emitStopTypingInActive,

    // Messages
    emitNewMessage:         socket.emitNewMessage,
    emitMessageEdited:      socket.emitMessageEdited,
    emitMessageDeleted:     socket.emitMessageDeleted,
    emitReactionToggled:    socket.emitReactionToggled,
    emitMessagePinned:      socket.emitMessagePinned,
    emitMessagesRead:       socket.emitMessagesRead,

    // Calls
    emitCallInitiated:      socket.emitCallInitiated,
    emitCallAccepted:       socket.emitCallAccepted,
    emitCallDeclined:       socket.emitCallDeclined,
    emitCallEnded:          socket.emitCallEnded,
    incomingCall:           socket.incomingCall,
    acceptIncomingCall:     socket.acceptIncomingCall,
    declineIncomingCall:    socket.declineIncomingCall,

    // Participants
    emitMemberAdded:        socket.emitMemberAdded,
    emitMemberRemoved:      socket.emitMemberRemoved,
    emitMemberLeft:         socket.emitMemberLeft,

    // Conversation
    emitConversationUpdated: socket.emitConversationUpdated,
    joinConversation:        socket.joinConversation,
    leaveConversationRoom:   socket.leaveConversationRoom,
  };
}