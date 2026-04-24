'use client';

import React, {
  useState, useEffect, useMemo, useCallback, memo,
} from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X, Pin, Calendar, Search, Loader2, File, Download,
  Image as ImageIcon, Play, Users, MessageSquare, Archive, Bell, BellOff,
  Crown, UserMinus, Trash2, LogOut, AlertTriangle,
} from 'lucide-react';

import {
  fetchPinnedMessages,
  fetchScheduledMessages,
  cancelScheduledMessage,
  fetchMediaMessages,
  searchMessages,
  fetchPartners,
  muteConversation,
  archiveConversation,
  leaveConversation,
  deleteConversation,
  promoteMember,
  removeMember,
  forwardMessage,
  fetchOnlinePresence,
  addMembers,
  selectPinnedMessages,
  selectScheduledMessages,
  selectMediaMessages,
  selectSearchResults,
  selectSearchLoading,
  selectPartners,
  selectLoadingPartners,
} from '@/store/slices/chatSlice';

import {
  formatTime, formatFileSize, getRoleLabel, getUserAvatar,
  isConvAdmin, PresenceDot,
} from './ChatPart1_Components';

// ─── CONFIRM DIALOG ───────────────────────────────────────────────────────────
// FIX #10: Replace window.confirm (blocks main thread, fails in iframes/PWA)
// with a lightweight inline modal component used by ConversationDetails.
const ConfirmDialog = memo(({ open, title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) => {
  if (!open) return null;
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 16 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 16 }}
        className="w-full max-w-xs rounded-2xl shadow-2xl overflow-hidden"
        style={{ background: 'var(--base-100)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-5">
          <div className="flex items-center gap-3 mb-3">
            {danger && (
              <span
                className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                style={{ background: 'color-mix(in oklch, var(--error) 15%, transparent)' }}
              >
                <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
              </span>
            )}
            <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
              {title}
            </h3>
          </div>
          <p className="text-xs leading-relaxed mb-5" style={{ color: 'var(--base-content)', opacity: 0.7 }}>
            {message}
          </p>
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium transition-colors"
              style={{ border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-colors"
              style={{
                background: danger ? 'var(--error)' : 'var(--primary)',
                color: danger ? 'var(--error-content)' : 'var(--primary-content)',
              }}
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  );
});
ConfirmDialog.displayName = 'ConfirmDialog';

// ─── PINNED MESSAGES PANEL ────────────────────────────────────────────────────
export const PinnedMessagesPanel = memo(({ conversationId, onClose, onScrollTo }) => {
  const dispatch       = useDispatch();
  const pinnedMessages = useSelector(selectPinnedMessages(conversationId));

  useEffect(() => {
    if (conversationId) dispatch(fetchPinnedMessages(conversationId));
  }, [conversationId, dispatch]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b overflow-hidden"
      style={{
        background:  'color-mix(in oklch, var(--warning) 6%, var(--base-100))',
        borderColor: 'var(--base-300)',
      }}
    >
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Pin size={13} style={{ color: 'var(--warning)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>
            {pinnedMessages.length} Pinned Message{pinnedMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
          aria-label="Close pinned messages"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-32 overflow-y-auto px-4 pb-2 space-y-1">
        {pinnedMessages.length === 0 ? (
          <p className="text-xs opacity-50 py-2" style={{ color: 'var(--base-content)' }}>
            No pinned messages
          </p>
        ) : pinnedMessages.map((msg) => (
          <button
            key={msg._id}
            className="w-full text-left px-3 py-1.5 rounded-xl text-xs transition-colors hover:bg-base-200 flex items-start gap-2"
            onClick={() => onScrollTo?.(msg._id)}
          >
            <Pin size={10} className="mt-0.5 shrink-0" style={{ color: 'var(--warning)' }} />
            <span className="truncate" style={{ color: 'var(--base-content)' }}>
              {msg.content || `[${msg.type}]`}
            </span>
            <span className="shrink-0 opacity-40 text-[10px]">{formatTime(msg.createdAt)}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
});
PinnedMessagesPanel.displayName = 'PinnedMessagesPanel';

// ─── SCHEDULED MESSAGES PANEL ─────────────────────────────────────────────────
export const ScheduledMessagesPanel = memo(({ conversationId, onClose }) => {
  const dispatch          = useDispatch();
  const scheduledMessages = useSelector(selectScheduledMessages(conversationId));

  useEffect(() => {
    if (conversationId) dispatch(fetchScheduledMessages(conversationId));
  }, [conversationId, dispatch]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b overflow-hidden"
      style={{
        background:  'color-mix(in oklch, var(--secondary) 6%, var(--base-100))',
        borderColor: 'var(--base-300)',
      }}
    >
      <div className="px-4 py-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Calendar size={13} style={{ color: 'var(--secondary)' }} />
          <span className="text-xs font-semibold" style={{ color: 'var(--base-content)' }}>
            {scheduledMessages.length} Scheduled Message{scheduledMessages.length !== 1 ? 's' : ''}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
          aria-label="Close scheduled messages"
        >
          <X size={14} />
        </button>
      </div>
      <div className="max-h-32 overflow-y-auto px-4 pb-2 space-y-1">
        {scheduledMessages.length === 0 ? (
          <p className="text-xs opacity-50 py-2" style={{ color: 'var(--base-content)' }}>
            No scheduled messages
          </p>
        ) : scheduledMessages.map((msg) => (
          <div
            key={msg._id}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl"
            style={{ background: 'var(--base-200)' }}
          >
            <Calendar size={10} className="shrink-0" style={{ color: 'var(--secondary)' }} />
            <span className="flex-1 truncate text-xs" style={{ color: 'var(--base-content)' }}>
              {msg.content || `[${msg.type}]`}
            </span>
            <span className="text-[10px] opacity-50 shrink-0">{formatTime(msg.scheduledAt)}</span>
            <button
              onClick={() => dispatch(cancelScheduledMessage({ conversationId, messageId: msg._id }))}
              className="p-0.5 rounded transition-colors hover:bg-base-300"
              aria-label="Cancel scheduled message"
              style={{ color: 'var(--error)' }}
            >
              <X size={10} />
            </button>
          </div>
        ))}
      </div>
    </motion.div>
  );
});
ScheduledMessagesPanel.displayName = 'ScheduledMessagesPanel';

// ─── MEDIA GALLERY PANEL ──────────────────────────────────────────────────────
// FIX: Loading indicator added when switching media type tabs
export const MediaGalleryPanel = memo(({ conversationId, onClose }) => {
  const dispatch      = useDispatch();
  const [mediaType, setMediaType] = useState('image');
  const [loadingMedia, setLoadingMedia] = useState(false);
  const mediaMessages = useSelector(selectMediaMessages(conversationId));

  useEffect(() => {
    if (!conversationId) return;
    setLoadingMedia(true);
    dispatch(fetchMediaMessages({ conversationId, type: mediaType }))
      .finally(() => setLoadingMedia(false));
  }, [conversationId, mediaType, dispatch]);

  const tabs = [
    { id: 'image', label: 'Photos', icon: '🖼️' },
    { id: 'video', label: 'Videos', icon: '🎥' },
    { id: 'file',  label: 'Files',  icon: '📄' },
    { id: 'audio', label: 'Audio',  icon: '🎵' },
  ];

  return (
    <motion.div
      initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
      transition={{ type: 'spring', damping: 25, stiffness: 200 }}
      className="absolute inset-y-0 right-0 w-72 flex flex-col z-10 shadow-2xl"
      style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}
      role="complementary"
      aria-label="Media gallery"
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--base-300)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
          Media & Files
        </h3>
        <button
          onClick={onClose}
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
          aria-label="Close gallery"
        >
          <X size={18} />
        </button>
      </div>
      <div
        className="flex border-b overflow-x-auto scrollbar-none"
        style={{ borderColor: 'var(--base-300)' }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setMediaType(tab.id)}
            className="flex-1 py-2 text-[10px] font-semibold transition-colors whitespace-nowrap px-2"
            style={{
              color:        mediaType === tab.id ? 'var(--primary)' : 'var(--base-content)',
              borderBottom: mediaType === tab.id ? '2px solid var(--primary)' : '2px solid transparent',
              opacity:      mediaType === tab.id ? 1 : 0.5,
            }}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>
      <div className="flex-1 overflow-y-auto p-2 relative">
        {/* FIX: Show loading indicator while fetching */}
        {loadingMedia && (
          <div className="absolute inset-0 flex items-center justify-center bg-base-100/60 z-10">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        )}
        {!loadingMedia && mediaMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 opacity-30">
            <ImageIcon size={32} className="mb-2" />
            <p className="text-xs" style={{ color: 'var(--base-content)' }}>
              No {mediaType} files
            </p>
          </div>
        ) : (
          <div className={
            mediaType === 'image' || mediaType === 'video'
              ? 'grid grid-cols-3 gap-1'
              : 'space-y-1'
          }>
            {mediaMessages.map((msg) => {
              const att = msg.attachments?.[0];
              if (!att) return null;
              if (mediaType === 'image') {
                return (
                  <img
                    key={msg._id}
                    src={att.url}
                    alt=""
                    className="w-full h-20 object-cover rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
                  />
                );
              }
              if (mediaType === 'video') {
                return (
                  <div
                    key={msg._id}
                    className="relative w-full h-20 rounded-lg overflow-hidden cursor-pointer group"
                  >
                    <video src={att.url} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                      <Play size={16} className="text-white" />
                    </div>
                  </div>
                );
              }
              return (
                <a
                  key={msg._id}
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.originalName}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl hover:bg-base-200 transition-colors"
                >
                  <File size={14} style={{ color: 'var(--primary)' }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate" style={{ color: 'var(--base-content)' }}>
                      {att.originalName || 'File'}
                    </p>
                    <p className="text-[10px] opacity-50" style={{ color: 'var(--base-content)' }}>
                      {formatFileSize(att.size)}
                    </p>
                  </div>
                  <Download size={12} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
                </a>
              );
            })}
          </div>
        )}
      </div>
    </motion.div>
  );
});
MediaGalleryPanel.displayName = 'MediaGalleryPanel';

// ─── SEARCH RESULTS PANEL ─────────────────────────────────────────────────────
export const SearchResultsPanel = memo(({ conversationId, query, onClose, onScrollTo }) => {
  const dispatch      = useDispatch();
  const searchResults = useSelector(selectSearchResults);
  const searchLoading = useSelector(selectSearchLoading);

  useEffect(() => {
    if (conversationId && query.trim().length >= 2) {
      dispatch(searchMessages({ conversationId, q: query }));
    }
  }, [conversationId, query, dispatch]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      className="border-b overflow-hidden"
      style={{ background: 'var(--base-100)', borderColor: 'var(--base-300)', maxHeight: 200 }}
    >
      <div
        className="px-4 py-2 flex items-center justify-between border-b"
        style={{ borderColor: 'var(--base-300)' }}
      >
        <span
          className="text-xs font-semibold flex items-center gap-1.5"
          style={{ color: 'var(--base-content)' }}
        >
          <Search size={11} />
          {searchLoading
            ? 'Searching…'
            : `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''} for "${query}"`}
        </span>
        <button
          onClick={onClose}
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
          aria-label="Close search results"
        >
          <X size={14} />
        </button>
      </div>
      <div className="overflow-y-auto" style={{ maxHeight: 150 }}>
        {searchLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 size={16} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : searchResults.length === 0 ? (
          <p className="text-xs opacity-50 text-center py-3" style={{ color: 'var(--base-content)' }}>
            No messages found
          </p>
        ) : searchResults.map((msg) => (
          <button
            key={msg._id}
            className="w-full text-left px-4 py-2 hover:bg-base-200 transition-colors"
            onClick={() => onScrollTo?.(msg._id)}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-semibold" style={{ color: 'var(--primary)' }}>
                {msg.sender?.name}
              </span>
              <span className="text-[10px] opacity-40" style={{ color: 'var(--base-content)' }}>
                {formatTime(msg.createdAt)}
              </span>
            </div>
            <p className="text-xs truncate" style={{ color: 'var(--base-content)' }}>
              {msg.content}
            </p>
          </button>
        ))}
      </div>
    </motion.div>
  );
});
SearchResultsPanel.displayName = 'SearchResultsPanel';

// ─── PARTNERS PANEL ───────────────────────────────────────────────────────────
export const PartnersPanel = memo(({ onClose, onStartChat, currentUserId }) => {
  const dispatch        = useDispatch();
  const partners        = useSelector(selectPartners);
  const loadingPartners = useSelector(selectLoadingPartners);
  const [partnerSearch, setPartnerSearch] = useState('');

  useEffect(() => {
    dispatch(fetchPartners());
  }, [dispatch]);

  const filtered = useMemo(() => {
    const q = partnerSearch.trim().toLowerCase();
    if (!q) return partners;
    return partners.filter((u) =>
      u.name?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.role?.toLowerCase().includes(q)
    );
  }, [partners, partnerSearch]);

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="absolute inset-y-0 left-0 w-72 flex flex-col z-10 shadow-2xl"
      style={{ background: 'var(--base-100)', borderRight: '1px solid var(--base-300)' }}
      role="complementary"
      aria-label="Partners"
    >
      <div
        className="flex items-center justify-between px-4 py-3 border-b"
        style={{ borderColor: 'var(--base-300)' }}
      >
        <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>People</h3>
        <button
          onClick={onClose}
          style={{ color: 'var(--base-content)', opacity: 0.5 }}
          aria-label="Close partners"
        >
          <X size={18} />
        </button>
      </div>
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--base-300)' }}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--base-200)' }}>
          <Search size={13} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
          <input
            value={partnerSearch}
            onChange={(e) => setPartnerSearch(e.target.value)}
            placeholder="Search people…"
            className="flex-1 bg-transparent text-xs outline-none"
            style={{ color: 'var(--base-content)' }}
            aria-label="Search people"
          />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto">
        {loadingPartners ? (
          <div className="flex justify-center py-8">
            <Loader2 size={20} className="animate-spin" style={{ color: 'var(--primary)' }} />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 opacity-30">
            <Users size={32} className="mb-2" />
            <p className="text-xs" style={{ color: 'var(--base-content)' }}>No people found</p>
          </div>
        ) : filtered.map((user) => (
          <div
            key={user._id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-base-200 transition-colors"
          >
            <div className="relative shrink-0">
              <img
                src={getUserAvatar(user)}
                alt={user.name}
                className="w-9 h-9 rounded-full object-cover"
              />
              <PresenceDot userId={user._id?.toString()} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate" style={{ color: 'var(--base-content)' }}>
                {user.name}
              </p>
              <p className="text-[10px] opacity-50" style={{ color: 'var(--base-content)' }}>
                {getRoleLabel(user.role)}
              </p>
            </div>
            {user._id?.toString() !== currentUserId?.toString() && (
              <button
                onClick={() => onStartChat?.(user)}
                className="p-1.5 rounded-lg transition-colors hover:bg-base-300"
                aria-label={`Chat with ${user.name}`}
                style={{ color: 'var(--primary)' }}
              >
                <MessageSquare size={14} />
              </button>
            )}
          </div>
        ))}
      </div>
    </motion.div>
  );
});
PartnersPanel.displayName = 'PartnersPanel';

// ─── CONVERSATION DETAILS ─────────────────────────────────────────────────────
// FIX #10: All window.confirm replaced with async ConfirmDialog component.
export const ConversationDetails = memo(({ conv, currentUserId, onClose, onShowMedia }) => {
  const dispatch = useDispatch();

  // FIX #10: Confirm dialog state
  const [confirmState, setConfirmState] = useState({
    open:    false,
    title:   '',
    message: '',
    danger:  false,
    label:   'Confirm',
    onConfirm: null,
  });

  const openConfirm = useCallback(({ title, message, danger = false, label = 'Confirm', onConfirm }) => {
    setConfirmState({ open: true, title, message, danger, label, onConfirm });
  }, []);

  const closeConfirm = useCallback(() => {
    setConfirmState((s) => ({ ...s, open: false, onConfirm: null }));
  }, []);

  if (!conv) return null;

  const myParticipant = conv.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() === currentUserId?.toString() && p.isActive
  );
  const isAdmin = isConvAdmin(myParticipant);

  const handleMute    = (mute) => dispatch(muteConversation({ conversationId: conv._id, mute }));
  const handleArchive = () => dispatch(archiveConversation({ conversationId: conv._id, archive: !conv.isArchived }));

  const handleLeave = () => {
    openConfirm({
      title:     'Leave Conversation',
      message:   'Are you sure you want to leave this conversation?',
      danger:    true,
      label:     'Leave',
      onConfirm: () => {
        dispatch(leaveConversation(conv._id));
        closeConfirm();
        onClose();
      },
    });
  };

  const handleDelete = () => {
    openConfirm({
      title:     'Delete Conversation',
      message:   'Delete this conversation for everyone? This cannot be undone.',
      danger:    true,
      label:     'Delete',
      onConfirm: () => {
        dispatch(deleteConversation(conv._id));
        closeConfirm();
        onClose();
      },
    });
  };

  const handlePromote = (userId, promote) =>
    dispatch(promoteMember({ conversationId: conv._id, userId, promote }));

  const handleRemove = (userId, userName) => {
    openConfirm({
      title:     'Remove Member',
      message:   `Remove ${userName || 'this member'} from the conversation?`,
      danger:    true,
      label:     'Remove',
      onConfirm: () => {
        dispatch(removeMember({ conversationId: conv._id, userId }));
        closeConfirm();
      },
    });
  };

  const activeMembers = conv.participants?.filter((p) => p.isActive) || [];
  const otherUser     = conv.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString()
  )?.user;

  return (
    <>
      {/* FIX #10: Inline confirm dialog — no window.confirm */}
      <AnimatePresence>
        {confirmState.open && (
          <ConfirmDialog
            open={confirmState.open}
            title={confirmState.title}
            message={confirmState.message}
            confirmLabel={confirmState.label}
            danger={confirmState.danger}
            onConfirm={confirmState.onConfirm}
            onCancel={closeConfirm}
          />
        )}
      </AnimatePresence>

      <motion.div
        initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-y-0 right-0 w-72 flex flex-col z-10 shadow-2xl"
        style={{ background: 'var(--base-100)', borderLeft: '1px solid var(--base-300)' }}
        role="complementary"
        aria-label="Conversation details"
      >
        <div
          className="flex items-center justify-between px-4 py-3 border-b"
          style={{ borderColor: 'var(--base-300)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>Details</h3>
          <button
            onClick={onClose}
            style={{ color: 'var(--base-content)', opacity: 0.5 }}
            aria-label="Close details"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex flex-col items-center py-5 border-b" style={{ borderColor: 'var(--base-300)' }}>
          <img
            src={
              conv.type === 'direct'
                ? getUserAvatar(otherUser)
                : (conv.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${conv._id}&backgroundColor=b6e3f4`)
            }
            alt=""
            className="w-16 h-16 rounded-full object-cover mb-2"
          />
          <p className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
            {conv.type === 'direct' ? otherUser?.name : conv.name}
          </p>
          {conv.type === 'direct' && otherUser?.role && (
            <span
              className="text-[10px] px-2.5 py-1 rounded-full mt-1 font-medium"
              style={{
                background: 'color-mix(in oklch, var(--primary) 12%, var(--base-200))',
                color:      'var(--primary)',
              }}
            >
              {getRoleLabel(otherUser.role)}
            </span>
          )}
          {conv.type !== 'direct' && (
            <p className="text-xs opacity-50 mt-0.5" style={{ color: 'var(--base-content)' }}>
              {activeMembers.length} members
            </p>
          )}
        </div>

        <div className="grid grid-cols-4 py-3 border-b" style={{ borderColor: 'var(--base-300)' }}>
          <button
            onClick={() => handleMute(!myParticipant?.isMuted)}
            className="flex flex-col items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity py-2"
            style={{ color: 'var(--base-content)' }}
            aria-label={myParticipant?.isMuted ? 'Unmute' : 'Mute'}
          >
            {myParticipant?.isMuted ? <Bell size={18} /> : <BellOff size={18} />}
            {myParticipant?.isMuted ? 'Unmute' : 'Mute'}
          </button>
          <button
            onClick={onShowMedia}
            className="flex flex-col items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity py-2"
            style={{ color: 'var(--base-content)' }}
            aria-label="Media & files"
          >
            <ImageIcon size={18} />
            Media
          </button>
          <button
            onClick={handleArchive}
            className="flex flex-col items-center gap-1 text-[10px] opacity-70 hover:opacity-100 transition-opacity py-2"
            style={{ color: conv.isArchived ? 'var(--primary)' : 'var(--base-content)' }}
            aria-label={conv.isArchived ? 'Unarchive' : 'Archive'}
          >
            <Archive size={18} />
            {conv.isArchived ? 'Unarchive' : 'Archive'}
          </button>
          <button
            onClick={handleLeave}
            className="flex flex-col items-center gap-1 text-[10px] hover:opacity-100 transition-opacity py-2"
            style={{ color: 'var(--error)', opacity: 0.7 }}
            aria-label="Leave conversation"
          >
            <LogOut size={18} />
            Leave
          </button>
        </div>

        {isAdmin && (
          <div className="border-b px-4 py-2" style={{ borderColor: 'var(--base-300)' }}>
            <button
              onClick={handleDelete}
              className="flex items-center gap-2 text-xs hover:opacity-100 transition-opacity w-full py-1.5"
              style={{ color: 'var(--error)', opacity: 0.7 }}
              aria-label="Delete conversation"
            >
              <Trash2 size={14} />
              Delete Conversation
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <p
            className="px-4 pt-3 pb-1 text-xs font-semibold uppercase tracking-wide opacity-50"
            style={{ color: 'var(--base-content)' }}
          >
            Members ({activeMembers.length})
          </p>
          {activeMembers.map((p) => {
            const uid   = p.user?._id || p.user;
            const uname = p.user?.name || 'Unknown';
            const uavtr = getUserAvatar(p.user);
            const urole = p.user?.role;
            const isSelf = uid?.toString() === currentUserId?.toString();
            return (
              <div
                key={uid?.toString()}
                className="flex items-center gap-3 px-4 py-3 hover:bg-base-200 transition-colors"
              >
                <div className="relative shrink-0">
                  <img src={uavtr} alt={uname} className="w-9 h-9 rounded-full object-cover" />
                  <PresenceDot userId={uid?.toString()} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate" style={{ color: 'var(--base-content)' }}>
                    {uname}
                  </p>
                  <div className="flex items-center gap-1.5">
                    <p className="text-[10px] opacity-50 capitalize" style={{ color: 'var(--base-content)' }}>
                      {p.conversationRole}
                    </p>
                    {urole && (
                      <span
                        className="text-[9px] px-1 py-0.5 rounded font-medium"
                        style={{ background: 'var(--base-300)', color: 'var(--base-content)', opacity: 0.7 }}
                      >
                        {getRoleLabel(urole)}
                      </span>
                    )}
                  </div>
                </div>
                {isAdmin && !isSelf && (
                  <div className="flex gap-1">
                    <button
                      onClick={() => handlePromote(uid, p.conversationRole !== 'admin')}
                      className="p-1.5 rounded-lg transition-colors hover:bg-base-300"
                      title={p.conversationRole === 'admin' ? 'Demote' : 'Make Admin'}
                      aria-label={p.conversationRole === 'admin' ? 'Demote member' : 'Promote to admin'}
                      style={{ color: p.conversationRole === 'admin' ? 'var(--warning)' : 'var(--success)' }}
                    >
                      <Crown size={12} />
                    </button>
                    <button
                      onClick={() => handleRemove(uid, uname)}
                      className="p-1.5 rounded-lg transition-colors hover:bg-base-300"
                      aria-label="Remove member"
                      style={{ color: 'var(--error)' }}
                    >
                      <UserMinus size={12} />
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
});
ConversationDetails.displayName = 'ConversationDetails';

// ─── FORWARD MODAL ─────────────────────────────────────────────────────────────
// FIX #11: Loading state added — tracks which conversation is being forwarded to.
// Prevents duplicate simultaneous forward requests.
export const ForwardModal = memo(({
  message, conversations, currentUserId, activeConvId, dispatch, onClose,
}) => {
  const [forwardingTo, setForwardingTo] = useState(null); // conversationId being forwarded

  const handleForward = useCallback(async (convId) => {
    if (forwardingTo) return; // FIX #11: block if already forwarding
    setForwardingTo(convId);
    try {
      await dispatch(forwardMessage({
        conversationId:        activeConvId,
        messageId:             message._id,
        targetConversationIds: [convId],
      }));
      onClose();
    } catch (err) {
      console.error('[ForwardModal] forward failed:', err);
      setForwardingTo(null);
    }
  }, [forwardingTo, activeConvId, message._id, dispatch, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Forward message"
    >
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--base-100)' }}
      >
        <div
          className="flex items-center justify-between px-5 py-4 border-b"
          style={{ borderColor: 'var(--base-300)' }}
        >
          <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
            Forward Message
          </h3>
          <button
            onClick={onClose}
            disabled={!!forwardingTo}
            className="transition-opacity disabled:opacity-40"
            style={{ color: 'var(--base-content)', opacity: 0.5 }}
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {conversations.filter((c) => c._id !== activeConvId).map((c) => {
            const other = c.participants?.find(
              (p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString() && p.isActive
            );
            const name  = c.type === 'direct'
              ? (other?.user?.name || 'Unknown')
              : (c.name || 'Group');
            const avtr  = c.type === 'direct'
              ? getUserAvatar(other?.user)
              : (c.avatar || `https://api.dicebear.com/7.x/identicon/svg?seed=${c._id}`);
            const isSending = forwardingTo === c._id;
            return (
              <button
                key={c._id}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-base-200 transition-colors text-left disabled:opacity-50"
                onClick={() => handleForward(c._id)}
                disabled={!!forwardingTo}
                aria-label={`Forward to ${name}`}
              >
                <img
                  src={avtr}
                  alt={name}
                  className="w-9 h-9 rounded-full object-cover shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <span
                    className="text-sm font-medium block truncate"
                    style={{ color: 'var(--base-content)' }}
                  >
                    {name}
                  </span>
                  {c.type === 'direct' && other?.user?.role && (
                    <span className="text-[10px] opacity-50" style={{ color: 'var(--base-content)' }}>
                      {getRoleLabel(other.user.role)}
                    </span>
                  )}
                </div>
                {/* FIX #11: Per-row loading spinner while forwarding */}
                {isSending && (
                  <Loader2 size={14} className="animate-spin shrink-0" style={{ color: 'var(--primary)' }} />
                )}
              </button>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
});
ForwardModal.displayName = 'ForwardModal';