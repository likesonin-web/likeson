'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Paperclip, Mic, MicOff, Phone, Video,
  Search, X, ArrowLeft, Pin, Reply, Edit3,
  Smile, MoreVertical, Circle, Users, Hash,
  Calendar, Loader2, ChevronDown,
} from 'lucide-react';

// ── All chatSlice imports ────────────────────────────────────────────────────
import {
  // Conversations
  fetchConversations,
  fetchConversation,          // FIX: was missing — needed after createConversation
  createConversation,
  updateConversation,
  archiveConversation,
  muteConversation,
  addMembers,
  removeMember,
  leaveConversation,
  promoteMember,
  deleteConversation,
  setActiveConversation,
  clearActiveConversation,

  // Messages
  fetchMessages,
  fetchMoreMessages,
  sendMessage,
  sendMediaMessage,
  sendMultipleMedia,
  sendRecordingMessage,
  sendStickerMessage,
  editMessage,
  deleteMessage,
  reactToMessage,
  pinMessage,
  fetchPinnedMessages,
  forwardMessage,
  markMessageRead,
  markMessageDelivered,
  markAllRead,
  searchMessages,
  fetchMediaMessages,
  fetchScheduledMessages,
  cancelScheduledMessage,

  // Calls
  initiateCall,
  endCall,
  updateCallStatus,
  setActiveCall,
  clearActiveCall,
  clearIncomingCall,

  // Presence & unread
  fetchOnlinePresence,
  fetchTotalUnreadCount,
  fetchConversationUnreadCount,

  // Partners
  fetchPartners,

  // Socket actions
  connectSocket,
  disconnectSocket,
  socketTypingStart,
  socketTypingStop,
  socketSendMessage,
  socketUploadRecording,
  socketCallRinging,
  socketCallEnd,
  socketCallDecline,
  socketCallMissed,
  socketCallMediaToggle,
  socketPresenceGet,

  // Upload helpers
  setUploadProgress,
  resetUploadProgress,        // FIX: added
  setRecordingProgress,
  resetRecordingProgress,     // FIX: added

  // Selectors
  selectAllConversations,
  selectMessagesByConversation,
  selectActiveConversationId,
  selectActiveConversation,
  selectSocketConnected,
  selectTypingUsers,
  selectUserPresence,
  selectTotalUnreadCount,
  selectSendingMessage,
  selectUploadProgress,
  selectIncomingCall,
  selectActiveCall,
  selectCallRinging,
  selectCallPeerMedia,
  selectCallMediaConstraints,
  selectSendingRecording,
  selectRecordingProgress,
  selectPinnedMessages,
  selectScheduledMessages,
  selectSearchResults,
  selectSearchLoading,
  selectMediaMessages,
  selectPartners,
  selectLoadingPartners,

  // Misc actions
  getSocket,
} from '@/store/slices/chatSlice';

import {
  formatTime, formatDate, formatSeconds, getUserAvatar, getRoleLabel, isConvAdmin,
  EmojiPicker, UploadPreviewModal, AttachMenu,
  PresenceDot, TypingIndicator, DateSeparator,
} from './ChatPart1_Components';

import {
  CallScreen, MessageBubble, ConversationItem,
  socketInitiateCall, socketCallOffer, socketCallAnswer, socketCallIce,
} from './ChatPart2_CallAndMessages';

import {
  PinnedMessagesPanel, ScheduledMessagesPanel, MediaGalleryPanel,
  SearchResultsPanel, PartnersPanel, ConversationDetails, ForwardModal,
} from './ChatPart3_Panels';

// ─────────────────────────────────────────────────────────────────────────────
// INFINITE SCROLL HOOK
// ─────────────────────────────────────────────────────────────────────────────
function useInfiniteScroll(containerRef, onLoadMore, hasMore, loading) {
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const handler = () => {
      if (container.scrollTop < 80 && hasMore && !loading) onLoadMore();
    };
    container.addEventListener('scroll', handler, { passive: true });
    return () => container.removeEventListener('scroll', handler);
  }, [containerRef, onLoadMore, hasMore, loading]);
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN CHAT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const Chat = () => {
  const dispatch = useDispatch();

  // ── Redux selectors ───────────────────────────────────────────────────────
  const currentUser    = useSelector((state) => state.user?.user) ?? null;
  const conversations  = useSelector(selectAllConversations);
  const activeConvId   = useSelector(selectActiveConversationId);
  const activeConv     = useSelector(selectActiveConversation);

  // Guard with ?? [] so messages is never undefined even before first fetch
  const messages = useSelector((s) => {
    const msgs = selectMessagesByConversation(s, activeConvId);
    return Array.isArray(msgs) ? msgs : [];
  });

  const socketConnected = useSelector(selectSocketConnected);
  const sendingMessage  = useSelector(selectSendingMessage);
  const uploadProgress  = useSelector(selectUploadProgress);
  const totalUnread     = useSelector(selectTotalUnreadCount);
  const incomingCall    = useSelector(selectIncomingCall);
  const activeCall      = useSelector(selectActiveCall);
  const sendingRec      = useSelector(selectSendingRecording);
  const recProgress     = useSelector(selectRecordingProgress);
  const callRinging     = useSelector(selectCallRinging);
  const peerMedia       = useSelector(selectCallPeerMedia);

  const messagePagination   = useSelector((s) => s.chat?.messagePagination?.[activeConvId] || {});
  const loadingMoreMessages = useSelector((s) => s.chat?.loadingMoreMessages);

  // ── Local state ───────────────────────────────────────────────────────────
  const [text,             setText]             = useState('');
  const [replyTo,          setReplyTo]          = useState(null);
  const [editingMsg,       setEditingMsg]        = useState(null);
  const [showAttach,       setShowAttach]        = useState(false);
  const [showEmoji,        setShowEmoji]         = useState(false);
  const [pendingFiles,     setPendingFiles]      = useState(null);
  const [recording,        setRecording]         = useState(false);
  const [recordDuration,   setRecordDuration]    = useState(0);
  const [searchQuery,      setSearchQuery]       = useState('');
  const [showSearch,       setShowSearch]        = useState(false);
  const [showMobileList,   setShowMobileList]    = useState(true);
  const [showDetails,      setShowDetails]       = useState(false);
  const [forwardMsg,       setForwardMsg]        = useState(null);
  const [msgSearchQuery,   setMsgSearchQuery]    = useState('');
  const [showMsgSearch,    setShowMsgSearch]     = useState(false);
  const [showPinned,       setShowPinned]        = useState(false);
  const [showScheduled,    setShowScheduled]     = useState(false);
  const [showMediaGallery, setShowMediaGallery]  = useState(false);
  const [showPartners,     setShowPartners]      = useState(false);
  const [showSearchResults,setShowSearchResults] = useState(false);

  // ── WebRTC signalling state ───────────────────────────────────────────────
  const [peerSdpAnswer, setPeerSdpAnswer] = useState(null);
  const [peerSdpOffer,  setPeerSdpOffer]  = useState(null);
  const [iceQueue,      setIceQueue]      = useState([]);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const messagesEndRef   = useRef(null);
  const inputRef         = useRef(null);
  const typingTimerRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef   = useRef([]);
  const recordTimerRef   = useRef(null);
  const attachMenuRef    = useRef(null);
  const emojiRef         = useRef(null);
  const messagesContRef  = useRef(null);
  const messageRefs      = useRef({});
  // Keep activeConvId in a ref so socket listeners always get the current value
  const activeConvIdRef  = useRef(activeConvId);
  useEffect(() => { activeConvIdRef.current = activeConvId; }, [activeConvId]);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
    if (token) dispatch(connectSocket(token));
    dispatch(fetchConversations());
    dispatch(fetchTotalUnreadCount());
    dispatch(fetchPartners());
    return () => { dispatch(disconnectSocket()); };
  }, [dispatch]);

  // ── Socket listeners for WebRTC signalling ────────────────────────────────
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onAnswer = (payload) => { setPeerSdpAnswer(payload.sdp || null); };
    const onOffer  = (payload) => { setPeerSdpOffer(payload.sdp  || null); };
    const onIce    = (payload) => {
      if (payload.candidate) setIceQueue((prev) => [...prev, payload.candidate]);
    };

    socket.on('call:answered', onAnswer);
    socket.on('call:offer',    onOffer);
    socket.on('call:ice',      onIce);

    return () => {
      socket.off('call:answered', onAnswer);
      socket.off('call:offer',    onOffer);
      socket.off('call:ice',      onIce);
    };
  }, [socketConnected]);

  // Mark message as read when received via socket while conversation is open
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    const onNewMessage = (payload) => {
      const convId = activeConvIdRef.current;
      if (
        payload?.conversationId === convId &&
        payload?.sender?._id !== currentUser?._id &&
        payload?._id
      ) {
        dispatch(markMessageRead({ conversationId: convId, messageId: payload._id }));
      }
    };

    socket.on('message:new',      onNewMessage);
    socket.on('message:received', onNewMessage);

    return () => {
      socket.off('message:new',      onNewMessage);
      socket.off('message:received', onNewMessage);
    };
  }, [socketConnected, currentUser?._id, dispatch]);

  // ── Reset signalling when call ends ───────────────────────────────────────
  useEffect(() => {
    if (!activeCall && !incomingCall) {
      setPeerSdpAnswer(null);
      setPeerSdpOffer(null);
      setIceQueue([]);
    }
  }, [activeCall, incomingCall]);

  // ── Load messages when conversation changes ───────────────────────────────
  useEffect(() => {
    if (!activeConvId) return;

    dispatch(fetchMessages({ conversationId: activeConvId }));
    dispatch(markAllRead(activeConvId));
    dispatch(fetchConversationUnreadCount(activeConvId));
    dispatch(fetchScheduledMessages(activeConvId));

    if (activeConv?.participants) {
      const ids = activeConv.participants
        .filter((p) => p.isActive)
        .map((p) => p.user?._id || p.user)
        .filter(Boolean);
      if (ids.length > 0) {
        dispatch(fetchOnlinePresence(ids));
        dispatch(socketPresenceGet(ids.map(String)));
      }
    }

    setShowMobileList(false);
    setShowPinned(false);
    setShowScheduled(false);
    setShowSearchResults(false);
    setMsgSearchQuery('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConvId, dispatch]);

  // ── Auto-scroll to bottom ─────────────────────────────────────────────────
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  // ── Close menus on outside click ──────────────────────────────────────────
  useEffect(() => {
    const handler = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) setShowAttach(false);
      if (emojiRef.current      && !emojiRef.current.contains(e.target))      setShowEmoji(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Infinite scroll ────────────────────────────────────────────────────────
  const handleLoadMore = useCallback(() => {
    if (!activeConvId || !messagePagination.hasMore || loadingMoreMessages) return;
    const oldestMsg = messages[0];
    if (oldestMsg) {
      dispatch(fetchMoreMessages({ conversationId: activeConvId, before: oldestMsg._id }));
    }
  }, [activeConvId, messagePagination.hasMore, loadingMoreMessages, messages, dispatch]);

  useInfiniteScroll(messagesContRef, handleLoadMore, messagePagination.hasMore, loadingMoreMessages);

  // ── Scroll to message ──────────────────────────────────────────────────────
  const scrollToMessage = useCallback((messageId) => {
    const el = messageRefs.current[messageId] || document.getElementById(`msg-${messageId}`);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  // ── Other participant ──────────────────────────────────────────────────────
  const otherParticipant = useMemo(() => {
    if (!activeConv || activeConv.type !== 'direct') return null;
    return activeConv.participants?.find(
      (p) => (p.user?._id || p.user)?.toString() !== currentUser?._id?.toString() && p.isActive
    );
  }, [activeConv, currentUser]);

  const otherUserId     = otherParticipant?.user?._id || otherParticipant?.user;
  const otherUserName   = otherParticipant?.user?.name || activeConv?.name || 'Chat';
  const otherUserAvatar = getUserAvatar(otherParticipant?.user);
  const otherUserRole   = otherParticipant?.user?.role;
  const otherPresence   = useSelector(selectUserPresence(otherUserId?.toString() || ''));

  // ── My conversation role ───────────────────────────────────────────────────
  const myParticipant = useMemo(() => {
    if (!activeConv) return null;
    return activeConv.participants?.find(
      (p) => (p.user?._id || p.user)?.toString() === currentUser?._id?.toString() && p.isActive
    );
  }, [activeConv, currentUser]);

  // ── Messages with date separators ─────────────────────────────────────────
  const messagesWithSeparators = useMemo(() => {
    const result   = [];
    let lastDate   = null;
    const filtered = msgSearchQuery.trim()
      ? messages.filter((m) => m.content?.toLowerCase().includes(msgSearchQuery.toLowerCase()))
      : messages;
    filtered.forEach((msg) => {
      const d = formatDate(msg.createdAt);
      if (d !== lastDate) {
        result.push({ _type: 'separator', date: d, _id: `sep-${d}` });
        lastDate = d;
      }
      result.push(msg);
    });
    return result;
  }, [messages, msgSearchQuery]);

  // ── Filtered conversations ─────────────────────────────────────────────────
  const filteredConversations = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) =>
      c.name?.toLowerCase().includes(q) ||
      c.participants?.some((p) => p.user?.name?.toLowerCase().includes(q))
    );
  }, [conversations, searchQuery]);

  // ── Text handlers ──────────────────────────────────────────────────────────
  const handleTextChange = useCallback((e) => {
    setText(e.target.value);
    if (!activeConvId) return;
    dispatch(socketTypingStart(activeConvId));
    clearTimeout(typingTimerRef.current);
    typingTimerRef.current = setTimeout(() => dispatch(socketTypingStop(activeConvId)), 1500);
  }, [activeConvId, dispatch]);

  const handleEmojiSelect = useCallback((emojiOrSticker) => {
    if (typeof emojiOrSticker === 'string') {
      setText((prev) => prev + emojiOrSticker);
      inputRef.current?.focus();
      setShowEmoji(false);
    } else {
      const { sticker } = emojiOrSticker;
      if (!activeConvId) return;
      dispatch(sendStickerMessage({
        conversationId: activeConvId,
        sticker,
        replyTo: replyTo?._id || undefined,
      })).then(() => { dispatch(fetchConversations()); });
      setReplyTo(null);
      setShowEmoji(false);
    }
  }, [activeConvId, replyTo, dispatch]);

  const handleSend = useCallback(async () => {
    const content = text.trim();
    if (!content || !activeConvId) return;
    clearTimeout(typingTimerRef.current);
    dispatch(socketTypingStop(activeConvId));
    setText('');

    if (editingMsg) {
      await dispatch(editMessage({
        conversationId: activeConvId,
        messageId:      editingMsg._id,
        content,
      }));
      setEditingMsg(null);
      return;
    }

    const payload = { type: 'text', content, replyTo: replyTo?._id || null };
    const socket  = getSocket();

    if (socket?.connected) {
      dispatch(socketSendMessage({ conversationId: activeConvId, ...payload }))
        .unwrap()
        .catch(() => dispatch(sendMessage({ conversationId: activeConvId, payload })));
    } else {
      await dispatch(sendMessage({ conversationId: activeConvId, payload }));
    }

    setReplyTo(null);
    inputRef.current?.focus();
    dispatch(fetchConversations());
  }, [text, activeConvId, editingMsg, replyTo, dispatch]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // ── File handlers ──────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((fileList) => {
    if (!fileList || fileList.length === 0) return;
    setPendingFiles(Array.from(fileList));
    setShowAttach(false);
  }, []);

  // FIX: After successful upload, reset progress AND refresh the conversation
  // so the last message preview in the sidebar updates immediately.
  const handleConfirmSend = useCallback(async (caption) => {
    if (!pendingFiles || !activeConvId) return;

    try {
      if (pendingFiles.length === 1) {
        const formData = new FormData();
        formData.append('file',           pendingFiles[0]);
        formData.append('conversationId', activeConvId);
        if (caption?.trim()) formData.append('caption', caption.trim());
        if (replyTo?._id)    formData.append('replyTo', replyTo._id);

        await dispatch(sendMediaMessage({
          conversationId: activeConvId,
          formData,
          onUploadProgress: (e) =>
            dispatch(setUploadProgress(Math.round((e.loaded * 100) / e.total))),
        }));
      } else {
        const formData = new FormData();
        pendingFiles.forEach((f) => formData.append('files', f));
        formData.append('conversationId', activeConvId);
        if (caption?.trim()) formData.append('caption', caption.trim());

        await dispatch(sendMultipleMedia({
          conversationId: activeConvId,
          formData,
          onUploadProgress: (e) =>
            dispatch(setUploadProgress(Math.round((e.loaded * 100) / e.total))),
        }));
      }
    } finally {
      // Always clean up, even on error
      setPendingFiles(null);
      setReplyTo(null);
      dispatch(resetUploadProgress());
      // FIX: Refresh conversations so lastMessage preview updates in sidebar
      dispatch(fetchConversations());
      // FIX: Refresh single conversation to keep Redux store in sync
      dispatch(fetchConversation(activeConvId));
    }
  }, [pendingFiles, activeConvId, replyTo, dispatch]);

  // ── Mark read ──────────────────────────────────────────────────────────────
  const handleMarkRead = useCallback((messageId) => {
    if (!activeConvId) return;
    dispatch(markMessageRead({ conversationId: activeConvId, messageId }));
    dispatch(markMessageDelivered({ conversationId: activeConvId, messageId }));
  }, [activeConvId, dispatch]);

  // ── Message search ─────────────────────────────────────────────────────────
  const handleMsgSearchChange = useCallback((val) => {
    setMsgSearchQuery(val);
    if (val.trim().length >= 2 && activeConvId) {
      setShowSearchResults(true);
      dispatch(searchMessages({ conversationId: activeConvId, q: val }));
    } else {
      setShowSearchResults(false);
    }
  }, [activeConvId, dispatch]);

  // ── Voice recording ────────────────────────────────────────────────────────
  const handleMicDown = useCallback(async () => {
    if (recording) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl:  true,
          sampleRate:       44100,
        },
      });
      audioChunksRef.current = [];

      const mimeType = [
        'audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4',
      ].find((m) => MediaRecorder.isTypeSupported(m)) || '';

      const mr = new MediaRecorder(stream, mimeType ? { mimeType } : {});

      mr.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      let secs = 0;
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        clearInterval(recordTimerRef.current);
        const finalDuration = secs;
        setRecordDuration(0);
        const blobMime = mimeType.split(';')[0] || 'audio/webm';
        const blob     = new Blob(audioChunksRef.current, { type: blobMime });
        if (blob.size < 500) { console.warn('[Chat] Recording too short'); return; }
        const ext = blobMime.includes('ogg') ? 'ogg' : blobMime.includes('mp4') ? 'mp4' : 'webm';
        const fd  = new FormData();
        fd.append('recording',      blob, `voice-message.${ext}`);
        fd.append('duration',       String(Math.round(finalDuration)));
        fd.append('conversationId', activeConvId);
        await dispatch(sendRecordingMessage({
          conversationId: activeConvId,
          formData:       fd,
          onUploadProgress: (e) =>
            dispatch(setUploadProgress(Math.round((e.loaded * 100) / e.total))),
        }));
        dispatch(resetUploadProgress());
        dispatch(fetchConversations());
      };

      mr.start(250);
      mediaRecorderRef.current = mr;
      setRecording(true);
      recordTimerRef.current = setInterval(() => { secs++; setRecordDuration(secs); }, 1000);
    } catch (err) {
      console.error('[Chat] Mic error:', err);
      alert('Microphone access denied. Please allow microphone permissions.');
    }
  }, [recording, activeConvId, dispatch]);

  const handleMicUp = useCallback(() => {
    if (!recording || !mediaRecorderRef.current) return;
    if (mediaRecorderRef.current.state === 'recording') mediaRecorderRef.current.stop();
    setRecording(false);
  }, [recording]);

  // ── Message actions ────────────────────────────────────────────────────────
  const handleReact = useCallback((messageId, emoji) => {
    const socket = getSocket();
    if (socket?.connected) socket.emit('message:react', { messageId, emoji });
    else dispatch(reactToMessage({ conversationId: activeConvId, messageId, emoji }));
  }, [dispatch, activeConvId]);

  const handlePin = useCallback((messageId, pin) => {
    dispatch(pinMessage({ conversationId: activeConvId, messageId, pin }));
  }, [dispatch, activeConvId]);

  const handleDelete = useCallback((messageId) => {
    if (!window.confirm('Delete this message for everyone?')) return;
    const socket = getSocket();
    if (socket?.connected) {
      socket.emit('message:delete', { messageId, scope: 'deleted_for_everyone' });
    } else {
      dispatch(deleteMessage({
        conversationId: activeConvId,
        messageId,
        scope: 'deleted_for_everyone',
      }));
    }
  }, [dispatch, activeConvId]);

  const handleEdit = useCallback((msg) => {
    setEditingMsg(msg);
    setText(msg.content);
    setTimeout(() => inputRef.current?.focus(), 50);
  }, []);

  const handleForward = useCallback((msg) => { setForwardMsg(msg); }, []);

  // ── Call handlers ──────────────────────────────────────────────────────────
  const handleStartCall = useCallback(async (callType) => {
    if (!activeConvId) return;
    const targetUserIds = (activeConv?.participants || [])
      .filter((p) => p.isActive && (p.user?._id || p.user)?.toString() !== currentUser?._id?.toString())
      .map((p) => p.user?._id || p.user);

    setPeerSdpAnswer(null);
    setPeerSdpOffer(null);
    setIceQueue([]);

    try {
      const result = await dispatch(socketInitiateCall({
        conversationId:   activeConvId,
        callType,
        targetUserIds,
        mediaConstraints: { audio: true, video: callType === 'video' },
      }));
      if (result?.messageId || result?.payload?.messageId) {
        dispatch(setActiveCall({
          conversationId:   activeConvId,
          callType,
          messageId:        result?.messageId || result?.payload?.messageId,
          status:           'calling',
          targetUserId:     targetUserIds[0] || null,
          mediaConstraints: { audio: true, video: callType === 'video' },
        }));
      }
    } catch (err) {
      const res = await dispatch(initiateCall({ conversationId: activeConvId, callType }));
      if (res?.payload?.messageId) {
        dispatch(setActiveCall({
          conversationId:   activeConvId,
          callType,
          messageId:        res.payload.messageId,
          status:           'calling',
          targetUserId:     targetUserIds[0] || null,
          mediaConstraints: { audio: true, video: callType === 'video' },
        }));
      }
    }
  }, [activeConvId, activeConv, currentUser, dispatch]);

  const handleAnswerCall = useCallback(async () => {
    if (incomingCall?.messageId) {
      await dispatch(updateCallStatus({
        conversationId: incomingCall.conversationId,
        messageId:      incomingCall.messageId,
        status:         'answered',
      }));
    }
  }, [incomingCall, dispatch]);

  const handleDeclineCall = useCallback(async () => {
    if (incomingCall) {
      dispatch(socketCallDecline({
        conversationId: incomingCall.conversationId,
        messageId:      incomingCall.messageId,
      }));
      dispatch(socketCallMissed({
        conversationId: incomingCall.conversationId,
        messageId:      incomingCall.messageId,
      }));
      if (incomingCall.messageId) {
        await dispatch(updateCallStatus({
          conversationId: incomingCall.conversationId,
          messageId:      incomingCall.messageId,
          status:         'declined',
        }));
      }
    }
    dispatch(clearIncomingCall());
    setPeerSdpOffer(null);
    setIceQueue([]);
  }, [incomingCall, dispatch]);

  const handleEndCall = useCallback(async () => {
    const call = activeCall || incomingCall;
    if (call?.messageId) {
      dispatch(socketCallEnd({
        conversationId: call.conversationId,
        messageId:      call.messageId,
        duration:       0,
      }));
      await dispatch(endCall({
        conversationId: call.conversationId,
        messageId:      call.messageId,
        duration:       0,
      }));
    }
    dispatch(clearActiveCall());
    dispatch(clearIncomingCall());
    setPeerSdpAnswer(null);
    setPeerSdpOffer(null);
    setIceQueue([]);
  }, [activeCall, incomingCall, dispatch]);

  // ── Start chat with partner ────────────────────────────────────────────────
  // FIX: After createConversation, must await fetchConversation(id) before
  // calling setActiveConversation — otherwise the conversation object is not
  // in the Redux store yet, causing a blank chat view.
  const handleStartChatWithPartner = useCallback(async (user) => {
    const existing = conversations.find((c) =>
      c.type === 'direct' &&
      c.participants?.some(
        (p) => (p.user?._id || p.user)?.toString() === user._id?.toString()
      )
    );
    if (existing) {
      dispatch(setActiveConversation(existing._id));
    } else {
      try {
        const result = await dispatch(createConversation({
          type:           'direct',
          participantIds: [user._id],
        }));
        const newConvId = result?.payload?.conversation?._id;
        if (newConvId) {
          // FIX: Load the conversation into Redux BEFORE activating it
          await dispatch(fetchConversation(newConvId));
          dispatch(setActiveConversation(newConvId));
          dispatch(fetchConversations());
        }
      } catch (_) {}
    }
    setShowPartners(false);
  }, [conversations, dispatch]);

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-screen overflow-hidden" style={{ background: 'var(--base-200)' }}>

      {/* ── Call Screen ──────────────────────────────────────────────────── */}
      <AnimatePresence>
        {(activeCall || incomingCall) && (
          <CallScreen
            call={incomingCall || activeCall}
            isIncoming={!!incomingCall && !activeCall}
            onEnd={handleEndCall}
            onAnswer={handleAnswerCall}
            onDecline={handleDeclineCall}
            peerSdpOffer={peerSdpOffer}
            peerSdpAnswer={peerSdpAnswer}
            iceCandidates={iceQueue}
          />
        )}
      </AnimatePresence>

      {/* ── Upload Preview ────────────────────────────────────────────────── */}
      <AnimatePresence>
        {pendingFiles && (
          <UploadPreviewModal
            files={pendingFiles}
            onSend={handleConfirmSend}
            onCancel={() => {
              setPendingFiles(null);
              dispatch(resetUploadProgress());
            }}
            progress={uploadProgress}
          />
        )}
      </AnimatePresence>

      {/* ── Forward Modal ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {forwardMsg && (
          <ForwardModal
            message={forwardMsg}
            conversations={conversations}
            currentUserId={currentUser?._id}
            activeConvId={activeConvId}
            dispatch={dispatch}
            onClose={() => setForwardMsg(null)}
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════════════
          LEFT SIDEBAR
      ══════════════════════════════════════════════════════════════════════ */}
      <aside
        className={`w-full md:w-80 flex flex-col shrink-0 ${activeConvId && !showMobileList ? 'hidden md:flex' : 'flex'}`}
        style={{ background: 'var(--base-100)', borderRight: '1px solid var(--base-300)' }}
        role="navigation"
        aria-label="Conversations"
      >
        <div className="px-4 pt-4 pb-3 shrink-0" style={{ borderBottom: '1px solid var(--base-300)' }}>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="relative shrink-0">
                <img
                  src={getUserAvatar(currentUser)}
                  alt={currentUser?.name || 'You'}
                  className="w-9 h-9 rounded-full object-cover"
                />
                <span
                  className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2"
                  style={{ background: 'var(--success)', borderColor: 'var(--base-100)' }}
                />
              </div>
              <div className="min-w-0">
                <p
                  className="font-semibold text-sm leading-tight truncate"
                  style={{ color: 'var(--base-content)' }}
                >
                  {currentUser?.name || 'You'}
                </p>
                {currentUser?.role && (
                  <p className="text-[10px] leading-tight" style={{ color: 'var(--primary)', opacity: 0.8 }}>
                    {getRoleLabel(currentUser.role)}
                  </p>
                )}
                <p
                  className="text-[10px] leading-tight flex items-center gap-1"
                  style={{
                    color:   socketConnected ? 'var(--success)' : 'var(--base-content)',
                    opacity: socketConnected ? 1 : 0.5,
                  }}
                  aria-live="polite"
                >
                  <Circle size={6} fill={socketConnected ? 'var(--success)' : 'currentColor'} />
                  {socketConnected ? 'Connected' : 'Connecting…'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <AnimatePresence>
                {totalUnread > 0 && (
                  <motion.span
                    initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                    className="text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1"
                    style={{ background: 'var(--error)', color: 'var(--error-content)' }}
                    aria-label={`${totalUnread} total unread`}
                  >
                    {totalUnread > 99 ? '99+' : totalUnread}
                  </motion.span>
                )}
              </AnimatePresence>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowPartners((v) => !v)}
                className="p-1.5 rounded-full transition-colors"
                style={{
                  background: showPartners
                    ? 'color-mix(in oklch, var(--primary) 12%, var(--base-100))'
                    : 'transparent',
                  color:   showPartners ? 'var(--primary)' : 'var(--base-content)',
                  opacity: showPartners ? 1 : 0.5,
                }}
                aria-label="Browse people"
                aria-pressed={showPartners}
              >
                <Users size={16} />
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.9 }}
                onClick={() => setShowSearch((v) => !v)}
                className="p-1.5 rounded-full transition-colors"
                style={{
                  background: showSearch
                    ? 'color-mix(in oklch, var(--primary) 12%, var(--base-100))'
                    : 'transparent',
                  color:   showSearch ? 'var(--primary)' : 'var(--base-content)',
                  opacity: showSearch ? 1 : 0.5,
                }}
                aria-label="Search conversations"
                aria-pressed={showSearch}
              >
                <Search size={16} />
              </motion.button>
            </div>
          </div>

          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
              >
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{ background: 'var(--base-200)' }}
                >
                  <Search size={13} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search conversations…"
                    autoFocus
                    className="flex-1 bg-transparent text-sm outline-none"
                    style={{ color: 'var(--base-content)' }}
                    aria-label="Search conversations"
                  />
                  {searchQuery && (
                    <button
                      onClick={() => setSearchQuery('')}
                      style={{ color: 'var(--base-content)', opacity: 0.4 }}
                      aria-label="Clear search"
                    >
                      <X size={13} />
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="flex-1 overflow-y-auto relative" role="list">
          <AnimatePresence>
            {showPartners && (
              <PartnersPanel
                onClose={() => setShowPartners(false)}
                onStartChat={handleStartChatWithPartner}
                currentUserId={currentUser?._id}
              />
            )}
          </AnimatePresence>

          {filteredConversations.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center h-full px-4"
              style={{ color: 'var(--base-content)', opacity: 0.4 }}
            >
              <Hash size={40} className="mb-3" />
              <p className="text-sm text-center">
                {searchQuery ? 'No conversations match' : 'No conversations yet'}
              </p>
            </div>
          ) : (
            filteredConversations.map((conv) => (
              <div key={conv._id} role="listitem">
                <ConversationItem
                  conv={conv}
                  isActive={conv._id === activeConvId}
                  currentUserId={currentUser?._id}
                  onClick={() => dispatch(setActiveConversation(conv._id))}
                />
              </div>
            ))
          )}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════
          MAIN CHAT AREA
      ══════════════════════════════════════════════════════════════════════ */}
      <main
        className={`flex-1 flex flex-col overflow-hidden relative ${!activeConvId || showMobileList ? 'hidden md:flex' : 'flex'}`}
        style={{ background: 'var(--base-200)' }}
        role="main"
        aria-label="Chat window"
      >
        {!activeConvId ? (
          <div
            className="flex-1 flex flex-col items-center justify-center"
            style={{ color: 'var(--base-content)', opacity: 0.4 }}
          >
            <motion.div
              animate={{ y: [0, -8, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            >
              <Users size={64} className="mb-4" />
            </motion.div>
            <h3 className="text-lg font-semibold mb-1">Select a conversation</h3>
            <p className="text-sm">Choose from your conversations on the left</p>
          </div>
        ) : (
          <>
            {/* ── Chat header ───────────────────────────────────────────── */}
            <header
              className="px-4 py-3 flex items-center gap-3 shrink-0"
              style={{
                background:   'var(--base-100)',
                borderBottom: '1px solid var(--base-300)',
                boxShadow:    '0 1px 4px rgba(0,0,0,0.04)',
              }}
            >
              <motion.button
                whileTap={{ scale: 0.9 }}
                className="md:hidden p-1 -ml-1 transition-colors"
                style={{ color: 'var(--base-content)', opacity: 0.6 }}
                onClick={() => {
                  setShowMobileList(true);
                  dispatch(clearActiveConversation());
                }}
                aria-label="Back to conversations"
              >
                <ArrowLeft size={20} />
              </motion.button>

              <div className="relative shrink-0">
                <img
                  src={
                    activeConv?.type === 'direct'
                      ? otherUserAvatar
                      : (activeConv?.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${activeConvId}&backgroundColor=b6e3f4`)
                  }
                  alt={otherUserName}
                  className="w-10 h-10 rounded-full object-cover"
                />
                {activeConv?.type === 'direct' && otherUserId && (
                  <PresenceDot userId={otherUserId?.toString()} />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <h3
                    className="font-semibold text-sm leading-tight truncate"
                    style={{ color: 'var(--base-content)' }}
                  >
                    {activeConv?.type === 'direct' ? otherUserName : (activeConv?.name || 'Group')}
                  </h3>
                  {activeConv?.type === 'direct' && otherUserRole && (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium shrink-0"
                      style={{
                        background: 'color-mix(in oklch, var(--primary) 12%, var(--base-200))',
                        color:      'var(--primary)',
                      }}
                    >
                      {getRoleLabel(otherUserRole)}
                    </span>
                  )}
                </div>
                <p className="text-xs leading-tight" style={{ color: 'var(--base-content)', opacity: 0.55 }}>
                  {activeConv?.type === 'direct'
                    ? otherPresence?.isOnline
                      ? <span style={{ color: 'var(--success)' }}>● Online</span>
                      : otherPresence?.lastseen
                        ? `Last seen ${formatTime(otherPresence.lastseen)}`
                        : 'Offline'
                    : `${activeConv?.participants?.filter((p) => p.isActive).length || 0} members`}
                </p>
              </div>

              <div className="flex items-center gap-0.5">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowPinned((v) => !v)}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: showPinned ? 'var(--warning)' : 'var(--base-content)', opacity: showPinned ? 1 : 0.6 }}
                  aria-label="Pinned messages"
                  aria-pressed={showPinned}
                >
                  <Pin size={16} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowScheduled((v) => !v)}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: showScheduled ? 'var(--secondary)' : 'var(--base-content)', opacity: showScheduled ? 1 : 0.6 }}
                  aria-label="Scheduled messages"
                  aria-pressed={showScheduled}
                >
                  <Calendar size={16} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMsgSearch((v) => !v)}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: showMsgSearch ? 'var(--primary)' : 'var(--base-content)', opacity: showMsgSearch ? 1 : 0.6 }}
                  aria-label="Search messages"
                  aria-pressed={showMsgSearch}
                >
                  <Search size={17} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleStartCall('audio')}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: 'var(--base-content)', opacity: 0.6 }}
                  aria-label="Start audio call"
                >
                  <Phone size={18} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => handleStartCall('video')}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: 'var(--base-content)', opacity: 0.6 }}
                  aria-label="Start video call"
                >
                  <Video size={18} />
                </motion.button>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowDetails((v) => !v); setShowMediaGallery(false); }}
                  className="p-2 rounded-full transition-colors"
                  style={{ color: showDetails ? 'var(--primary)' : 'var(--base-content)', opacity: showDetails ? 1 : 0.6 }}
                  aria-label="Conversation details"
                  aria-pressed={showDetails}
                >
                  <MoreVertical size={18} />
                </motion.button>
              </div>
            </header>

            <AnimatePresence>
              {showPinned && (
                <PinnedMessagesPanel
                  conversationId={activeConvId}
                  onClose={() => setShowPinned(false)}
                  onScrollTo={scrollToMessage}
                />
              )}
            </AnimatePresence>
            <AnimatePresence>
              {showScheduled && (
                <ScheduledMessagesPanel
                  conversationId={activeConvId}
                  onClose={() => setShowScheduled(false)}
                />
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showMsgSearch && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="px-4 py-2 border-b"
                  style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)' }}
                >
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: 'var(--base-200)' }}
                  >
                    <Search size={13} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
                    <input
                      value={msgSearchQuery}
                      onChange={(e) => handleMsgSearchChange(e.target.value)}
                      placeholder="Search messages…"
                      autoFocus
                      className="flex-1 bg-transparent text-sm outline-none"
                      style={{ color: 'var(--base-content)' }}
                      aria-label="Search messages"
                    />
                    {msgSearchQuery && (
                      <button
                        onClick={() => { setMsgSearchQuery(''); setShowSearchResults(false); }}
                        style={{ color: 'var(--base-content)', opacity: 0.4 }}
                        aria-label="Clear search"
                      >
                        <X size={13} />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {showSearchResults && msgSearchQuery.trim().length >= 2 && (
                <SearchResultsPanel
                  conversationId={activeConvId}
                  query={msgSearchQuery}
                  onClose={() => setShowSearchResults(false)}
                  onScrollTo={scrollToMessage}
                />
              )}
            </AnimatePresence>

            {/* ── Messages area ──────────────────────────────────────────── */}
            <div className="flex flex-1 overflow-hidden relative">
              {loadingMoreMessages && (
                <div className="absolute top-2 left-0 right-0 flex justify-center z-10">
                  <span
                    className="flex items-center gap-1.5 text-xs px-3 py-1 rounded-full shadow-sm"
                    style={{ background: 'var(--base-100)', color: 'var(--base-content)', opacity: 0.7 }}
                  >
                    <Loader2 size={12} className="animate-spin" /> Loading older messages…
                  </span>
                </div>
              )}

              <div
                ref={messagesContRef}
                className="flex-1 overflow-y-auto px-3 pt-3 pb-1"
                style={{
                  backgroundImage: `radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--base-300) 60%, transparent) 1px, transparent 0)`,
                  backgroundSize:  '24px 24px',
                }}
                role="log"
                aria-label="Messages"
                aria-live="polite"
              >
                {messagesWithSeparators.map((item) => {
                  if (item._type === 'separator') {
                    return <DateSeparator key={item._id} label={item.date} />;
                  }
                  const isMine = (item.sender?._id || item.sender)?.toString() === currentUser?._id?.toString();
                  return (
                    <div
                      key={item._id}
                      id={`msg-${item._id}`}
                      ref={(el) => { if (el) messageRefs.current[item._id] = el; }}
                    >
                      <MessageBubble
                        message={item}
                        isMine={isMine}
                        onReact={handleReact}
                        onReply={setReplyTo}
                        onDelete={handleDelete}
                        onEdit={handleEdit}
                        onPin={handlePin}
                        onForward={handleForward}
                        onMarkRead={handleMarkRead}
                      />
                    </div>
                  );
                })}
                <div ref={messagesEndRef} className="h-1" />
              </div>

              <AnimatePresence>
                {showDetails && !showMediaGallery && (
                  <ConversationDetails
                    conv={activeConv}
                    currentUserId={currentUser?._id}
                    onClose={() => setShowDetails(false)}
                    onShowMedia={() => { setShowMediaGallery(true); setShowDetails(false); }}
                  />
                )}
              </AnimatePresence>

              <AnimatePresence>
                {showMediaGallery && (
                  <MediaGalleryPanel
                    conversationId={activeConvId}
                    onClose={() => setShowMediaGallery(false)}
                  />
                )}
              </AnimatePresence>
            </div>

            <AnimatePresence>
              <TypingIndicator conversationId={activeConvId} />
            </AnimatePresence>

            {/* ── Reply strip ────────────────────────────────────────────── */}
            <AnimatePresence>
              {replyTo && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-3 mb-1.5 flex items-center gap-2 rounded-2xl px-3 py-2"
                  style={{
                    background: 'color-mix(in oklch, var(--primary) 8%, var(--base-100))',
                    border:     '1px solid color-mix(in oklch, var(--primary) 25%, transparent)',
                  }}
                  role="status"
                  aria-label={`Replying to ${replyTo.sender?.name || 'message'}`}
                >
                  <Reply size={14} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0 border-l-2 pl-2" style={{ borderColor: 'var(--primary)' }}>
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--primary)' }}>
                      Replying to {replyTo.sender?.name || 'message'}
                      {replyTo.sender?.role && (
                        <span className="opacity-60 font-normal">
                          {' '}· {getRoleLabel(replyTo.sender.role)}
                        </span>
                      )}
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--base-content)', opacity: 0.7 }}>
                      {replyTo.content || `[${replyTo.type}]`}
                    </p>
                  </div>
                  <button
                    onClick={() => setReplyTo(null)}
                    style={{ color: 'var(--base-content)', opacity: 0.4 }}
                    aria-label="Cancel reply"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Edit banner ────────────────────────────────────────────── */}
            <AnimatePresence>
              {editingMsg && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mx-3 mb-1.5 flex items-center gap-2 rounded-2xl px-3 py-2"
                  style={{
                    background: 'color-mix(in oklch, var(--warning) 8%, var(--base-100))',
                    border:     '1px solid color-mix(in oklch, var(--warning) 30%, transparent)',
                  }}
                  role="status"
                  aria-label="Editing message"
                >
                  <Edit3 size={14} style={{ color: 'var(--warning)', flexShrink: 0 }} />
                  <div className="flex-1 min-w-0 border-l-2 pl-2" style={{ borderColor: 'var(--warning)' }}>
                    <p className="text-[10px] font-semibold mb-0.5" style={{ color: 'var(--warning)' }}>
                      Editing message
                    </p>
                    <p className="text-xs truncate" style={{ color: 'var(--base-content)', opacity: 0.7 }}>
                      {editingMsg.content}
                    </p>
                  </div>
                  <button
                    onClick={() => { setEditingMsg(null); setText(''); }}
                    style={{ color: 'var(--base-content)', opacity: 0.4 }}
                    aria-label="Cancel edit"
                  >
                    <X size={14} />
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Upload progress (inline, outside modal) ────────────────── */}
            {uploadProgress > 0 && uploadProgress < 100 && (
              <div className="mx-3 mb-1.5">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--base-300)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--primary)', width: `${uploadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-right mt-0.5 opacity-50" style={{ color: 'var(--base-content)' }}>
                  {uploadProgress}% uploading…
                </p>
              </div>
            )}
            {sendingRec && recProgress > 0 && recProgress < 100 && (
              <div className="mx-3 mb-1.5">
                <div className="h-1 rounded-full overflow-hidden" style={{ background: 'var(--base-300)' }}>
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: 'var(--secondary)', width: `${recProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
                <p className="text-[10px] text-right mt-0.5 opacity-50" style={{ color: 'var(--base-content)' }}>
                  {recProgress}% uploading recording…
                </p>
              </div>
            )}

            {/* ── Input bar ──────────────────────────────────────────────── */}
            {/* FIX: z-20 creates a proper stacking context so attach menu (z-30)
                and emoji picker (z-40) render above the messages scroll area   */}
            <div
              className="px-2 py-2 flex items-end gap-2 relative shrink-0 z-20"
              style={{ background: 'var(--base-100)', borderTop: '1px solid var(--base-300)' }}
              role="form"
              aria-label="Message input"
            >
              <div className="relative shrink-0" ref={attachMenuRef}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowAttach((v) => !v); setShowEmoji(false); }}
                  className="p-2.5 rounded-full transition-colors"
                  style={{
                    background: showAttach
                      ? 'color-mix(in oklch, var(--primary) 12%, var(--base-100))'
                      : 'transparent',
                    color:   showAttach ? 'var(--primary)' : 'var(--base-content)',
                    opacity: showAttach ? 1 : 0.5,
                  }}
                  aria-label="Attach file"
                  aria-pressed={showAttach}
                >
                  <Paperclip size={18} />
                </motion.button>
                <AnimatePresence>
                  {showAttach && (
                    <AttachMenu
                      onFileSelect={handleFileSelect}
                      onClose={() => setShowAttach(false)}
                    />
                  )}
                </AnimatePresence>
              </div>

              <div className="relative shrink-0" ref={emojiRef}>
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={() => { setShowEmoji((v) => !v); setShowAttach(false); }}
                  className="p-2.5 rounded-full transition-colors"
                  style={{
                    background: showEmoji
                      ? 'color-mix(in oklch, var(--primary) 12%, var(--base-100))'
                      : 'transparent',
                    color:   showEmoji ? 'var(--primary)' : 'var(--base-content)',
                    opacity: showEmoji ? 1 : 0.5,
                  }}
                  aria-label="Emoji and stickers"
                  aria-pressed={showEmoji}
                >
                  <Smile size={18} />
                </motion.button>
                <AnimatePresence>
                  {showEmoji && (
                    <EmojiPicker
                      onSelect={handleEmojiSelect}
                      onClose={() => setShowEmoji(false)}
                    />
                  )}
                </AnimatePresence>
              </div>

              <textarea
                ref={inputRef}
                value={text}
                onChange={handleTextChange}
                onKeyDown={handleKeyDown}
                placeholder={
                  editingMsg  ? 'Edit your message…'
                  : recording ? `Recording… ${formatSeconds(recordDuration)} — release to send`
                  : 'Type a message…'
                }
                rows={1}
                disabled={recording}
                className="flex-1 resize-none rounded-2xl px-4 py-2.5 text-sm outline-none transition-all max-h-32 leading-relaxed disabled:opacity-60"
                style={{
                  background: 'var(--base-200)',
                  color:      'var(--base-content)',
                  border:     '1px solid var(--base-300)',
                  minHeight:  '44px',
                }}
                aria-label="Message"
                aria-multiline="true"
                onInput={(e) => {
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 128) + 'px';
                }}
              />

              {text.trim() ? (
                <motion.button
                  whileTap={{ scale: 0.92 }} whileHover={{ scale: 1.05 }}
                  onClick={handleSend}
                  disabled={sendingMessage}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center shadow-md transition-colors disabled:opacity-50"
                  style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
                  aria-label="Send message"
                >
                  {sendingMessage
                    ? <Loader2 size={16} className="animate-spin" />
                    : <Send size={16} />}
                </motion.button>
              ) : (
                <motion.button
                  whileTap={{ scale: 0.92 }}
                  onMouseDown={handleMicDown}
                  onMouseUp={handleMicUp}
                  onMouseLeave={handleMicUp}
                  onTouchStart={(e) => { e.preventDefault(); handleMicDown(); }}
                  onTouchEnd={handleMicUp}
                  className="shrink-0 w-11 h-11 rounded-full flex items-center justify-center transition-colors"
                  style={{
                    background: recording ? 'var(--primary)' : 'transparent',
                    color:      recording ? 'var(--primary-content)' : 'var(--base-content)',
                    opacity:    recording ? 1 : 0.5,
                    boxShadow:  recording
                      ? '0 0 0 6px color-mix(in oklch, var(--primary) 20%, transparent)'
                      : 'none',
                  }}
                  title={recording ? 'Release to send' : 'Hold to record voice'}
                  aria-label={
                    recording
                      ? `Recording ${formatSeconds(recordDuration)}, release to send`
                      : 'Hold to record voice message'
                  }
                  aria-pressed={recording}
                >
                  {sendingRec
                    ? <Loader2 size={18} className="animate-spin" />
                    : recording
                    ? <MicOff size={18} />
                    : <Mic size={18} />}
                </motion.button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default Chat;