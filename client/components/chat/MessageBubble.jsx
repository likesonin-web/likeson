'use client';
import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Reply, Smile, MoreVertical, Edit2, Trash2, Pin,
  Forward, Copy, Check, CheckCheck, AlertCircle,
  Play, Download, FileText, MapPin, Phone, Video,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { formatTime, getInitials } from '@/lib/chatUtils';
import { EmojiPicker } from './ChatWidgets';

const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageBubble({ message, isMine, showAvatar, conversation, onReply, currentUserId }) {
  const { deleteMessage, editMessage, reactToMessage, pinMessage } = useChat();

  const [menuOpen, setMenuOpen]   = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [editing, setEditing]     = useState(false);
  const [editText, setEditText]   = useState(message.text || '');
  const [copied, setCopied]       = useState(false);
  const [menuPos, setMenuPos]     = useState({ top: 0, left: 0 });
  const [emojiPos, setEmojiPos]   = useState({ top: 0, left: 0 });

  const bubbleRef   = useRef(null);
  const menuBtnRef  = useRef(null);
  const emojiBtnRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    if (!menuOpen && !emojiOpen) return;
    const handler = (e) => {
      // Don't close if clicking inside portal menus themselves
      if (e.target.closest('[data-chat-portal]')) return;
      setMenuOpen(false);
      setEmojiOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen, emojiOpen]);

  // BUG3 FIX: Position context menu using fixed coords from button position
  const openMenu = useCallback((e) => {
    e.stopPropagation();
    setEmojiOpen(false);
    const rect = menuBtnRef.current?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    // Menu width ~192px, height ~280px approx
    const menuW = 192;
    const menuH = 280;
    let top  = rect.bottom + 4;
    let left = isMine ? rect.right - menuW : rect.left;
    if (top + menuH > vh) top = rect.top - menuH - 4;
    if (left + menuW > vw) left = vw - menuW - 8;
    if (left < 8) left = 8;
    setMenuPos({ top, left });
    setMenuOpen((v) => !v);
  }, [isMine]);

  const openEmoji = useCallback((e) => {
    e.stopPropagation();
    setMenuOpen(false);
    const rect = (emojiBtnRef.current || bubbleRef.current)?.getBoundingClientRect();
    if (!rect) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const pickerW = 288;
    const pickerH = 256;
    let top  = rect.top - pickerH - 8;
    let left = isMine ? rect.right - pickerW : rect.left;
    if (top < 8) top = rect.bottom + 8;
    if (left + pickerW > vw) left = vw - pickerW - 8;
    if (left < 8) left = 8;
    setEmojiPos({ top, left });
    setEmojiOpen((v) => !v);
  }, [isMine]);

  if (message.deletedForAll) {
    return (
      <div className={`msg-deleted-row ${isMine ? 'msg-deleted-row-mine' : ''}`}>
        <span className="msg-deleted-pill">
          <AlertCircle size={12} /> Message deleted
        </span>
      </div>
    );
  }

  if (message.type === 'call_log') return <CallLogBubble message={message} />;

  if (message.type === 'system') {
    return (
      <div className="msg-system-row">
        <span className="msg-system-pill">{message.text}</span>
      </div>
    );
  }

  const handleReact = (emoji) => {
    reactToMessage(message._id, conversation._id, emoji);
    setEmojiOpen(false);
    setMenuOpen(false);
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(message.text || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
    setMenuOpen(false);
  };

  const handleEditSave = () => {
    if (editText.trim() && editText !== message.text) {
      editMessage(message._id, conversation._id, editText.trim());
    }
    setEditing(false);
  };

  const senderName   = message.sender?.name || 'Unknown';
  const senderAvatar = message.sender?.avatar;
  const reactions    = message.reactions || [];

  const reactionGroups = reactions.reduce((acc, r) => {
    if (!acc[r.emoji]) acc[r.emoji] = [];
    acc[r.emoji].push(r.user);
    return acc;
  }, {});

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
      className={`msg-row ${isMine ? 'msg-row-mine' : 'msg-row-theirs'}`}
    >
      {/* Avatar col */}
      {!isMine && (
        <div className="msg-avatar-col">
          {showAvatar ? (
            senderAvatar ? (
              <img src={senderAvatar} alt={senderName} className="msg-avatar-img" />
            ) : (
              <div className="msg-avatar-fallback"><span>{getInitials(senderName)}</span></div>
            )
          ) : (
            <div className="msg-avatar-spacer" />
          )}
        </div>
      )}

      {/* Bubble group */}
      <div className={`msg-bubble-group ${isMine ? 'msg-bubble-group-mine' : ''}`}>
        {!isMine && showAvatar && conversation.type === 'group' && (
          <span className="msg-sender-name">{senderName}</span>
        )}

        {/* Reply preview inside bubble */}
        {message.replyTo && (
          <div className={`msg-reply-preview-bubble ${isMine ? 'msg-reply-preview-mine' : ''}`}>
            <div className="msg-reply-bar" />
            <div>
              <span className="msg-reply-sender">{message.replyTo.sender?.name || 'Unknown'}</span>
              <p className="msg-reply-text">
                {message.replyTo.type === 'text'
                  ? message.replyTo.text?.slice(0, 80)
                  : `[${message.replyTo.type}]`}
              </p>
            </div>
          </div>
        )}

        {/* BUG3 FIX: Hover action row — positioned outside bubble, state-driven visibility */}
        <div className="msg-row-inner" ref={bubbleRef}>
          {/* Action buttons row — only shown on hover via CSS group */}
          <div className={`msg-hover-actions ${isMine ? 'msg-hover-actions-mine' : ''}`}>
            <button ref={emojiBtnRef} onClick={openEmoji} className="msg-quick-btn" title="React">
              <Smile size={14} />
            </button>
            <button onClick={() => onReply(message)} className="msg-quick-btn" title="Reply">
              <Reply size={14} />
            </button>
            <button ref={menuBtnRef} onClick={openMenu} className="msg-quick-btn" title="More">
              <MoreVertical size={14} />
            </button>
          </div>

          {/* Bubble */}
          <div className={`msg-bubble ${isMine ? 'msg-bubble-mine' : 'msg-bubble-theirs'}`}>
            {editing ? (
              <div className="msg-edit-wrap">
                <input
                  autoFocus
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleEditSave();
                    if (e.key === 'Escape') setEditing(false);
                  }}
                  className="msg-edit-input"
                />
                <div className="msg-edit-actions">
                  <button onClick={() => setEditing(false)} className="msg-edit-cancel">Cancel</button>
                  <button onClick={handleEditSave} className="msg-edit-save">Save</button>
                </div>
              </div>
            ) : (
              <MessageContent message={message} isMine={isMine} />
            )}

            {/* Meta */}
            <div className={`msg-meta ${isMine ? 'msg-meta-mine' : ''}`}>
              {message.isEdited && <span className="msg-edited-label">edited</span>}
              <span className="msg-time">{formatTime(message.createdAt)}</span>
              {isMine && (
                <span className="msg-status">
                  {message.readAt ? (
                    <CheckCheck size={13} className="msg-status-read" />
                  ) : message.deliveredAt ? (
                    <CheckCheck size={13} className="msg-status-delivered" />
                  ) : (
                    <Check size={13} className="msg-status-sent" />
                  )}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Reactions */}
        {Object.keys(reactionGroups).length > 0 && (
          <div className={`msg-reactions ${isMine ? 'msg-reactions-mine' : ''}`}>
            {Object.entries(reactionGroups).map(([emoji, users]) => {
              const myReacted = users.some((u) => {
                const uid = u?._id?.toString() || u?.toString();
                return uid === currentUserId?.toString();
              });
              return (
                <button
                  key={emoji}
                  onClick={() => handleReact(emoji)}
                  className={`msg-reaction-chip ${myReacted ? 'msg-reaction-chip-active' : ''}`}
                >
                  {emoji} <span>{users.length}</span>
                </button>
              );
            })}
            <button onClick={openEmoji} className="msg-reaction-add">
              <Smile size={12} />
            </button>
          </div>
        )}
      </div>

      {/* BUG3 FIX: Context menu rendered in portal at fixed screen position */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {menuOpen && (
            <motion.div
              data-chat-portal
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.1 }}
              style={{ position: 'fixed', top: menuPos.top, left: menuPos.left, zIndex: 9999 }}
              className="msg-context-menu"
            >
              {/* Quick reactions */}
              <div className="msg-context-reactions">
                {QUICK_REACTIONS.map((e) => (
                  <button key={e} onClick={() => handleReact(e)} className="msg-context-emoji-btn">{e}</button>
                ))}
              </div>
              <div className="msg-context-divider" />

              <button className="msg-context-item" onClick={() => { onReply(message); setMenuOpen(false); }}>
                <Reply size={14} /> Reply
              </button>
              {message.type === 'text' && (
                <button className="msg-context-item" onClick={handleCopy}>
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                  {copied ? 'Copied!' : 'Copy text'}
                </button>
              )}
              <button className="msg-context-item" onClick={() => {
                pinMessage(message._id, conversation._id, !message.isPinned);
                setMenuOpen(false);
              }}>
                <Pin size={14} /> {message.isPinned ? 'Unpin' : 'Pin message'}
              </button>
              {isMine && message.type === 'text' && (
                <button className="msg-context-item" onClick={() => { setEditing(true); setMenuOpen(false); }}>
                  <Edit2 size={14} /> Edit message
                </button>
              )}
              <div className="msg-context-divider" />
              <button
                className="msg-context-item msg-context-danger"
                onClick={() => {
                  deleteMessage(message._id, conversation._id, isMine ? 'for_all' : 'for_me');
                  setMenuOpen(false);
                }}
              >
                <Trash2 size={14} />
                {isMine ? 'Delete for everyone' : 'Delete for me'}
              </button>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}

      {/* BUG3 FIX: Emoji picker in portal at computed position */}
      {typeof window !== 'undefined' && createPortal(
        <AnimatePresence>
          {emojiOpen && (
            <div
              data-chat-portal
              style={{ position: 'fixed', top: emojiPos.top, left: emojiPos.left, zIndex: 9999 }}
            >
              <EmojiPicker onSelect={handleReact} onClose={() => setEmojiOpen(false)} />
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}

// ─── Content renderers ────────────────────────────────────────────────────────

function MessageContent({ message, isMine }) {
  switch (message.type) {
    case 'text':
      return <p className="msg-text">{message.text}</p>;

    case 'image':
      return (
        <div className="msg-media-wrap">
          <img src={message.media?.url} alt="Image" className="msg-media-img" loading="lazy" />
        </div>
      );

    case 'video':
      return (
        <div className="msg-media-wrap msg-media-video">
          <video src={message.media?.url} controls className="msg-media-img" poster={message.media?.thumbnail} />
        </div>
      );

    case 'audio':
      return (
        <div className="msg-audio-wrap">
          <audio src={message.media?.url} controls className="msg-audio-player" />
          {message.media?.duration > 0 && (
            <span className="msg-audio-duration">
              {Math.floor(message.media.duration / 60)}:{String(Math.round(message.media.duration % 60)).padStart(2, '0')}
            </span>
          )}
        </div>
      );

    case 'file':
      return (
        <a href={message.media?.url} target="_blank" rel="noreferrer" className="msg-file-wrap">
          <FileText size={22} className="msg-file-icon" />
          <div className="msg-file-info">
            <span className="msg-file-name">{message.media?.fileName || 'File'}</span>
            {message.media?.size && <span className="msg-file-size">{formatBytes(message.media.size)}</span>}
          </div>
          <Download size={16} className="msg-file-download" />
        </a>
      );

    case 'location':
      return (
        <div className="msg-location-wrap">
          <MapPin size={18} className="msg-location-icon" />
          <div>
            <p className="msg-location-label">Location shared</p>
            {message.location?.address && <p className="msg-location-address">{message.location.address}</p>}
          </div>
        </div>
      );

    default:
      return <p className="msg-text">{message.text || `[${message.type}]`}</p>;
  }
}

function CallLogBubble({ message }) {
  const { callLog } = message;
  const Icon = callLog?.callType === 'video' ? Video : Phone;
  const colorClass = {
    answered: 'msg-call-answered',
    missed:   'msg-call-missed',
    declined: 'msg-call-declined',
    cancelled:'msg-call-cancelled',
  }[callLog?.status] || '';

  return (
    <div className="msg-system-row">
      <div className={`msg-call-pill ${colorClass}`}>
        <Icon size={14} />
        <span>
          {callLog?.callType === 'video' ? 'Video' : 'Voice'} call · {callLog?.status}
          {callLog?.duration > 0 && ` · ${Math.floor(callLog.duration / 60)}:${String(callLog.duration % 60).padStart(2,'0')}`}
        </span>
      </div>
    </div>
  );
}

function formatBytes(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1048576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1048576).toFixed(1)} MB`;
}