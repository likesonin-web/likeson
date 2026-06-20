'use client';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MoreVertical, Archive, VolumeX, Volume2, Trash2, Check, CheckCheck } from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { formatRelativeTime, getConvoName, getConvoAvatar, getInitials } from '@/lib/chatUtils';

export default function ConversationItem({ conversation, currentUserId, isActive, onSelect }) {
  const { archiveConversation, muteConversation, clearConversation } = useChat();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const name    = getConvoName(conversation, currentUserId);
  const avatar  = getConvoAvatar(conversation, currentUserId);
  const initials = getInitials(name);
  const unread  = conversation.unreadCount || 0;
  const last    = conversation.lastMessage;
  const isMuted = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() === currentUserId
  )?.isMuted;

  const isLastMine = last?.sender?.toString() === currentUserId ||
                     last?.sender?._id?.toString() === currentUserId;

  const handleMenuAction = (e, fn) => {
    e.stopPropagation();
    setMenuOpen(false);
    fn();
  };

  return (
    <div
      className={`conv-item ${isActive ? 'conv-item-active' : ''}`}
      onClick={onSelect}
    >
      {/* Avatar */}
      <div className="conv-item-avatar-wrap">
        {avatar ? (
          <img src={avatar} alt={name} className="conv-item-avatar-img" />
        ) : (
          <div className="conv-item-avatar-fallback">
            <span>{initials}</span>
          </div>
        )}
        {/* Online dot - only for direct */}
        {conversation.type === 'direct' && (
          <span className="conv-item-online-dot" />
        )}
        {/* Group icon overlay */}
        {conversation.type === 'group' && (
          <span className="conv-item-group-badge">G</span>
        )}
      </div>

      {/* Content */}
      <div className="conv-item-content">
        <div className="conv-item-top-row">
          <span className="conv-item-name">{name}</span>
          <div className="conv-item-meta">
            {isMuted && <VolumeX size={12} className="conv-item-mute-icon" />}
            <span className="conv-item-time">
              {last?.sentAt ? formatRelativeTime(last.sentAt) : ''}
            </span>
          </div>
        </div>

        <div className="conv-item-bottom-row">
          <div className="conv-item-preview">
            {isLastMine && (
              <span className="conv-item-tick">
                {last?.readAt ? (
                  <CheckCheck size={13} className="text-primary" />
                ) : (
                  <Check size={13} className="text-base-content/40" />
                )}
              </span>
            )}
            <p className="conv-item-last-msg">
              {last?.type === 'text'
                ? last.text
                : last?.type
                ? `[${last.type}]`
                : 'No messages yet'}
            </p>
          </div>

          <div className="conv-item-badges">
            {unread > 0 && (
              <span className="conv-item-unread-badge">
                {unread > 99 ? '99+' : unread}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Kebab menu */}
      <div className="conv-item-menu-wrap" onClick={(e) => e.stopPropagation()}>
        <button
          className="conv-item-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
        >
          <MoreVertical size={15} />
        </button>

        <AnimatePresence>
          {menuOpen && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: -4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: -4 }}
              transition={{ duration: 0.12 }}
              className="conv-item-dropdown"
            >
              <button
                className="conv-item-dropdown-item"
                onClick={(e) => handleMenuAction(e, () =>
                  archiveConversation(conversation._id, true)
                )}
              >
                <Archive size={14} /> Archive
              </button>
              <button
                className="conv-item-dropdown-item"
                onClick={(e) => handleMenuAction(e, () =>
                  muteConversation(conversation._id, !isMuted)
                )}
              >
                {isMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                {isMuted ? 'Unmute' : 'Mute'}
              </button>
              <div className="conv-item-dropdown-divider" />
              <button
                className="conv-item-dropdown-item conv-item-dropdown-danger"
                onClick={(e) => handleMenuAction(e, () =>
                  clearConversation(conversation._id)
                )}
              >
                <Trash2 size={14} /> Clear chat
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}