'use client';
/**
 * providers/ChatProvider.jsx
 * Fixes applied:
 *  - useMemo value: was missing ALL callbacks in deps → stale closures on every call action
 *    Fix: remove useMemo entirely, use useRef for stable object + expose callbacks individually
 *  - socket ref never updated in value: socket.current changes after connect
 *  - typingTimers cleanup on unmount
 *  - Token refresh: reconnect with new token when token prop changes
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { io } from 'socket.io-client';
import { useDispatch, useSelector } from 'react-redux';
import { selectActiveConversationId } from '../store/slices/chatSlice';
import {
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
  fetchTotalUnread,
  joinCallThunk,
  initiateCallThunk,
  endCallThunk,
  clearIncomingCall,
} from '../store/slices/chatSlice';

// ─── Context ──────────────────────────────────────────────────────────────────

const ChatSocketContext = createContext(null);

// ─── Provider ─────────────────────────────────────────────────────────────────

export const ChatProvider = ({ children, token }) => {
  const dispatch   = useDispatch();
  const socketRef  = useRef(null);
  const [connected, setConnected]   = useState(false);
  const [socketId,  setSocketId]    = useState(null);

  const activeConversationId = useSelector(selectActiveConversationId);
  const typingTimers         = useRef({});
  const activeConvoRef       = useRef(activeConversationId);

  useEffect(() => {
    activeConvoRef.current = activeConversationId;
  }, [activeConversationId]);

  // ── Socket lifecycle ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;

    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:5050';

    const socket = io(`${SOCKET_URL}/chat`, {
      auth:               { token },
      transports:         ['websocket', 'polling'],
      reconnection:       true,
      reconnectionDelay:  1000,
      reconnectionAttempts: 10,
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setSocketId(socket.id);
      console.log('[ChatSocket] connected:', socket.id);
    });

    socket.on('disconnect', (reason) => {
      setConnected(false);
      console.log('[ChatSocket] disconnected:', reason);
    });

    socket.on('connect_error', (err) => {
      console.error('[ChatSocket] connect error:', err.message);
    });

    socket.on('init', ({ unreadCount }) => {
      dispatch({ type: 'chat/fetchTotalUnread/fulfilled', payload: unreadCount });
    });

    socket.on('new_message', (message) => {
      const conversationId =
        typeof message.conversation === 'object'
          ? message.conversation?._id?.toString()
          : message.conversation?.toString();
      if (!conversationId) return;

      dispatch(socketNewMessage({ conversationId, message }));

      const currentActiveId = activeConvoRef.current?.toString();
      if (currentActiveId === conversationId) {
        socket.emit('mark_read', { conversationId });
      }
      socket.emit('mark_delivered', { conversationId });
    });

    socket.on('message_edited', (message) => {
      const conversationId = message.conversation?._id || message.conversation;
      dispatch(socketMessageEdited({ conversationId: conversationId?.toString(), message }));
    });

    socket.on('message_deleted', (payload) => {
      dispatch(socketMessageDeleted(payload));
    });

    socket.on('message_reaction', ({ messageId, reactions, conversationId }) => {
      dispatch(socketMessageReaction({
        messageId,
        reactions,
        conversationId: conversationId?.toString?.() || conversationId,
      }));
    });

    socket.on('messages_read', (payload) => {
      dispatch(socketMessagesRead({
        ...payload,
        readAt: payload.readAt || new Date().toISOString(),
      }));
    });

    socket.on('messages_delivered', (payload) => {
      dispatch(socketMessagesDelivered({
        ...payload,
        deliveredAt: payload.deliveredAt || new Date().toISOString(),
      }));
    });

    socket.on('user_typing', (payload) => {
      dispatch(socketUserTyping(payload));
      const key = `${payload.conversationId}:${payload.userId}`;
      if (typingTimers.current[key]) clearTimeout(typingTimers.current[key]);
      if (payload.isTyping) {
        typingTimers.current[key] = setTimeout(() => {
          dispatch(socketUserTyping({ ...payload, isTyping: false }));
          delete typingTimers.current[key];
        }, 5000);
      }
    });

    socket.on('user:online', (payload) => {
      dispatch(socketUserPresence(payload));
    });

    socket.on('incoming_call', (payload) => {
      dispatch(socketIncomingCall(payload));
    });

    socket.on('call_participant_joined', (payload) => {
      dispatch(socketCallParticipantJoined(payload));
    });

    socket.on('call_declined', (payload) => {
      dispatch(socketCallDeclined(payload));
    });

    socket.on('call_ended', (payload) => {
      dispatch(socketCallEnded(payload));
    });

    socket.on('call_cancelled', (payload) => {
      dispatch(socketCallCancelled(payload));
    });

    return () => {
      socket.disconnect();
      Object.values(typingTimers.current).forEach(clearTimeout);
    };
  }, [token, dispatch]);

  // ── Auto-join active conversation room ─────────────────────────────────────
  useEffect(() => {
    if (!connected || !activeConversationId) return;
    socketRef.current?.emit('join_conversation', { conversationId: activeConversationId });
  }, [connected, activeConversationId]);

  // ─────────────────────────────────────────────────────────────────────────
  // PUBLIC API — useCallback with stable deps (no useMemo wrapping object)
  // FIX: removed useMemo({ ... }, [connected, socketId]) which caused ALL
  //      callbacks to be stale because they weren't in the dependency array.
  //      Now each callback is individually stable via useCallback.
  // ─────────────────────────────────────────────────────────────────────────

  const joinConversation = useCallback((conversationId) => {
    socketRef.current?.emit('join_conversation', { conversationId });
  }, []);

  const leaveConversation = useCallback((conversationId) => {
    socketRef.current?.emit('leave_conversation', { conversationId });
  }, []);

  const sendMessage = useCallback(
    (conversationId, payload) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          return reject(new Error('Socket not connected'));
        }
        socketRef.current.emit(
          'send_message',
          { conversationId, ...payload },
          (ack) => {
            if (ack?.success) resolve(ack.message);
            else reject(new Error(ack?.error || 'Send failed'));
          }
        );
      }),
    []
  );

  const markRead = useCallback((conversationId) => {
    socketRef.current?.emit('mark_read', { conversationId });
  }, []);

  const markDelivered = useCallback((conversationId) => {
    socketRef.current?.emit('mark_delivered', { conversationId });
  }, []);

  const sendTyping = useCallback((conversationId, isTyping) => {
    socketRef.current?.emit('typing', { conversationId, isTyping });
  }, []);

  const editMessage = useCallback(
    (messageId, text) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('edit_message', { messageId, text }, (ack) => {
          if (ack?.success) resolve(ack.message);
          else reject(new Error(ack?.error || 'Edit failed'));
        });
      }),
    []
  );

  const deleteMessage = useCallback(
    (messageId, scope = 'for_me') =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('delete_message', { messageId, scope }, (ack) => {
          if (ack?.success) resolve();
          else reject(new Error(ack?.error || 'Delete failed'));
        });
      }),
    []
  );

  const reactMessage = useCallback(
    (messageId, emoji) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('react_message', { messageId, emoji }, (ack) => {
          if (ack?.success) resolve(ack.reactions);
          else reject(new Error(ack?.error || 'React failed'));
        });
      }),
    []
  );

  // ── Calls ──────────────────────────────────────────────────────────────────

  const initiateCall = useCallback(
    (conversationId, type = 'audio') =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          return dispatch(initiateCallThunk({ conversationId, type }))
            .unwrap()
            .then(resolve)
            .catch(reject);
        }
        socketRef.current.emit('call_initiate', { conversationId, type }, (ack) => {
          if (ack?.success) {
            dispatch({
              type:    'chat/initiateCall/fulfilled',
              payload: { ...ack, conversationId, type },
            });
            resolve(ack);
          } else {
            reject(new Error(ack?.error || 'Call initiation failed'));
          }
        });
      }),
    [dispatch]
  );

  const joinCall = useCallback(
    (callId) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          return dispatch(joinCallThunk(callId)).unwrap().then(resolve).catch(reject);
        }
        socketRef.current.emit('call_join', { callId }, (ack) => {
          if (ack?.success) {
            dispatch({ type: 'chat/joinCall/fulfilled', payload: ack });
            dispatch(clearIncomingCall());
            resolve(ack);
          } else {
            reject(new Error(ack?.error || 'Join failed'));
          }
        });
      }),
    [dispatch]
  );

  const declineCall = useCallback(
    (callId) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('call_decline', { callId }, (ack) => {
          if (ack?.success) resolve();
          else reject(new Error(ack?.error || 'Decline failed'));
        });
      }),
    []
  );

  const endCall = useCallback(
    (callId) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) {
          return dispatch(endCallThunk({ callId, status: 'ended' }))
            .unwrap()
            .then(resolve)
            .catch(reject);
        }
        socketRef.current.emit('call_end', { callId }, (ack) => {
          if (ack?.success) {
            dispatch({ type: 'chat/endCall/fulfilled', payload: ack });
            resolve(ack);
          } else {
            reject(new Error(ack?.error || 'End call failed'));
          }
        });
      }),
    [dispatch]
  );

  const cancelCall = useCallback(
    (callId) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('call_cancel', { callId }, (ack) => {
          if (ack?.success) resolve();
          else reject(new Error(ack?.error || 'Cancel failed'));
        });
      }),
    []
  );

  const renewCallToken = useCallback(
    (callId) =>
      new Promise((resolve, reject) => {
        if (!socketRef.current?.connected) return reject(new Error('Socket not connected'));
        socketRef.current.emit('call_token_renew', { callId }, (ack) => {
          if (ack?.success) resolve(ack);
          else reject(new Error(ack?.error || 'Token renew failed'));
        });
      }),
    []
  );

  const sendMuteState = useCallback((callId, isMuted, isCamOff) => {
    socketRef.current?.emit('call_mute_toggle', { callId, isMuted, isCamOff });
  }, []);

  // FIX: No useMemo wrapper. Expose all values directly.
  // Components using useChatSocket() get stable function refs via useCallback above.
  return (
    <ChatSocketContext.Provider
      value={{
        socket:   socketRef.current,
        connected,
        socketId,
        joinConversation,
        leaveConversation,
        sendMessage,
        markRead,
        markDelivered,
        sendTyping,
        editMessage,
        deleteMessage,
        reactMessage,
        initiateCall,
        joinCall,
        declineCall,
        endCall,
        cancelCall,
        renewCallToken,
        sendMuteState,
      }}
    >
      {children}
    </ChatSocketContext.Provider>
  );
};

export const useChatSocket = () => {
  const ctx = useContext(ChatSocketContext);
  if (!ctx) throw new Error('useChatSocket must be used inside <ChatProvider>');
  return ctx;
};

export default ChatProvider;