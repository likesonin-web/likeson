'use client';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  Users, Pin, Trash2, Archive, VolumeX, Volume2,
  X, User, Crown, LogOut,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import { useConversationPinned } from '@/hooks/useChat';
import { getConvoName, getConvoAvatar, getInitials, formatRelativeTime } from '@/lib/chatUtils';

export default function ChatHeader({ conversation, currentUserId, onBack, onSearchToggle, searchOpen }) {
  const {
    initiateCall, archiveConversation, muteConversation,
    clearConversation, activeCall, loadPinned,
  } = useChat();

  const [menuOpen, setMenuOpen]       = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);
  const [pinnedOpen, setPinnedOpen]   = useState(false);
  const [callError, setCallError]     = useState('');
  const menuWrapRef = useRef(null);

  const name      = getConvoName(conversation, currentUserId);
  const avatar    = getConvoAvatar(conversation, currentUserId);
  const initials  = getInitials(name);
  const isGroup   = conversation.type === 'group';
  const members   = conversation.participants?.filter((p) => !p.isDeleted) || [];
  const memberCount = members.length;

  const isMuted = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() === currentUserId
  )?.isMuted;

  const canCall = ['direct', 'group'].includes(conversation.type);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    const handler = (e) => {
      if (menuWrapRef.current && !menuWrapRef.current.contains(e.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [menuOpen]);

  // BUG1 FIX: Before initiating call, check if activeCall exists and clear stale ref
  const handleCall = async (type) => {
    setCallError('');
    // If there's already an activeCall in Redux for THIS conversation, end it first or warn
    if (activeCall && activeCall.conversationId === conversation._id) {
      setCallError('A call is already active. End it first.');
      setTimeout(() => setCallError(''), 3000);
      return;
    }
    try {
      await initiateCall(conversation._id, type);
    } catch (err) {
      // Server returns 409 "A call is already active in this conversation"
      // This means conversation.activeCall is stale — we can't auto-fix server state from client
      // Show a user-friendly message instead of crashing
      const msg = err?.message || String(err);
      if (msg.includes('already active')) {
        setCallError('Another call is active. Please wait or ask the other party to end it.');
      } else {
        setCallError(msg || 'Could not start call');
      }
      setTimeout(() => setCallError(''), 4000);
    }
  };

  return (
    <>
      <header className="chat-header">
        {/* Left */}
        <div className="chat-header-left">
          <button onClick={onBack} className="chat-header-back" aria-label="Back">
            <ArrowLeft size={20} />
          </button>

          <button
            className="chat-header-avatar-btn"
            onClick={() => isGroup ? setGroupInfoOpen(true) : null}
            style={{ cursor: isGroup ? 'pointer' : 'default' }}
          >
            <div className="chat-header-avatar-wrap">
              {avatar ? (
                <img src={avatar} alt={name} className="chat-header-avatar-img" />
              ) : (
                <div className="chat-header-avatar-fallback">
                  <span>{initials}</span>
                </div>
              )}
              {!isGroup && <span className="chat-header-online-dot" />}
            </div>
          </button>

          <div className="chat-header-info">
            <h2 className="chat-header-name">{name}</h2>
            <p className="chat-header-sub">
              {isGroup
                ? `${memberCount} member${memberCount !== 1 ? 's' : ''}`
                : 'Online'}
            </p>
          </div>
        </div>

        {/* Call error toast */}
        <AnimatePresence>
          {callError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="chat-header-call-error"
            >
              {callError}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Right actions */}
        <div className="chat-header-actions">
          {canCall && (
            <>
              <button
                onClick={() => handleCall('audio')}
                className="chat-header-action-btn"
                aria-label="Voice call"
                title="Voice call"
              >
                <Phone size={18} />
              </button>
              <button
                onClick={() => handleCall('video')}
                className="chat-header-action-btn"
                aria-label="Video call"
                title="Video call"
              >
                <Video size={18} />
              </button>
            </>
          )}

          <button
            onClick={onSearchToggle}
            className={`chat-header-action-btn ${searchOpen ? 'chat-header-action-btn-active' : ''}`}
            aria-label="Search messages"
            title="Search"
          >
            <Search size={18} />
          </button>

          {/* Kebab */}
          <div className="chat-header-menu-wrap" ref={menuWrapRef}>
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className={`chat-header-action-btn ${menuOpen ? 'chat-header-action-btn-active' : ''}`}
              aria-label="More options"
            >
              <MoreVertical size={18} />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -4 }}
                  transition={{ duration: 0.12 }}
                  className="chat-header-dropdown"
                >
                  {isGroup && (
                    <button
                      className="chat-header-dropdown-item"
                      onClick={() => { setMenuOpen(false); setGroupInfoOpen(true); }}
                    >
                      <Users size={14} /> Group info
                    </button>
                  )}
                  <button
                    className="chat-header-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      loadPinned(conversation._id);
                      setPinnedOpen(true);
                    }}
                  >
                    <Pin size={14} /> Pinned messages
                  </button>
                  <button
                    className="chat-header-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      muteConversation(conversation._id, !isMuted);
                    }}
                  >
                    {isMuted ? <Volume2 size={14} /> : <VolumeX size={14} />}
                    {isMuted ? 'Unmute' : 'Mute notifications'}
                  </button>
                  <button
                    className="chat-header-dropdown-item"
                    onClick={() => {
                      setMenuOpen(false);
                      archiveConversation(conversation._id, true);
                    }}
                  >
                    <Archive size={14} /> Archive chat
                  </button>
                  <div className="chat-header-dropdown-divider" />
                  <button
                    className="chat-header-dropdown-item chat-header-dropdown-danger"
                    onClick={() => {
                      setMenuOpen(false);
                      if (window.confirm('Clear all messages for you?')) {
                        clearConversation(conversation._id);
                      }
                    }}
                  >
                    <Trash2 size={14} /> Clear chat
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </header>

      {/* Group Info Panel */}
      <AnimatePresence>
        {groupInfoOpen && (
          <GroupInfoPanel
            conversation={conversation}
            currentUserId={currentUserId}
            onClose={() => setGroupInfoOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Pinned Messages Panel */}
      <AnimatePresence>
        {pinnedOpen && (
          <PinnedMessagesPanel
            conversationId={conversation._id}
            onClose={() => setPinnedOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}

// ─── Group Info Panel ─────────────────────────────────────────────────────────
function GroupInfoPanel({ conversation, currentUserId, onClose }) {
  const members = conversation.participants?.filter((p) => !p.isDeleted) || [];
  const me = members.find((p) => (p.user?._id || p.user)?.toString() === currentUserId);
  const amAdmin = me?.isAdmin;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="side-panel-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="side-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="side-panel-header">
          <h3 className="side-panel-title">Group Info</h3>
          <button onClick={onClose} className="side-panel-close"><X size={18} /></button>
        </div>

        {/* Group avatar + name */}
        <div className="side-panel-group-hero">
          <div className="side-panel-group-avatar">
            {conversation.avatar
              ? <img src={conversation.avatar} alt={conversation.name} className="w-full h-full object-cover rounded-full" />
              : <span className="side-panel-group-avatar-initials">{getInitials(conversation.name || 'G')}</span>
            }
          </div>
          <h4 className="side-panel-group-name">{conversation.name}</h4>
          {conversation.description && (
            <p className="side-panel-group-desc">{conversation.description}</p>
          )}
          <p className="side-panel-group-meta">{members.length} members</p>
        </div>

        {/* Members list */}
        <div className="side-panel-section-label">Members</div>
        <div className="side-panel-members">
          {members.map((p) => {
            const uid  = p.user?._id || p.user;
            const name = p.user?.name || 'User';
            const avatar = p.user?.avatar;
            const isMe = uid?.toString() === currentUserId;
            return (
              <div key={uid?.toString()} className="side-panel-member-row">
                <div className="side-panel-member-avatar">
                  {avatar
                    ? <img src={avatar} alt={name} className="w-full h-full object-cover rounded-full" />
                    : <span>{getInitials(name)}</span>
                  }
                </div>
                <div className="side-panel-member-info">
                  <span className="side-panel-member-name">{name}{isMe ? ' (You)' : ''}</span>
                  {p.role && <span className="side-panel-member-role">{p.role}</span>}
                </div>
                {p.isAdmin && (
                  <span className="side-panel-admin-badge">
                    <Crown size={11} /> Admin
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Pinned Messages Panel ─────────────────────────────────────────────────────
function PinnedMessagesPanel({ conversationId, onClose }) {
  const pinned = useConversationPinned(conversationId);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="side-panel-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="side-panel"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="side-panel-header">
          <h3 className="side-panel-title">Pinned Messages</h3>
          <button onClick={onClose} className="side-panel-close"><X size={18} /></button>
        </div>

        <div className="side-panel-pinned-list">
          {pinned.length === 0 ? (
            <div className="side-panel-empty">
              <Pin size={28} className="side-panel-empty-icon" />
              <p>No pinned messages</p>
            </div>
          ) : (
            pinned.map((msg) => (
              <div key={msg._id} className="side-panel-pinned-item">
                <div className="side-panel-pinned-accent" />
                <div className="side-panel-pinned-body">
                  <span className="side-panel-pinned-sender">{msg.sender?.name || 'Unknown'}</span>
                  <p className="side-panel-pinned-text">
                    {msg.type === 'text' ? msg.text : `[${msg.type}]`}
                  </p>
                  <span className="side-panel-pinned-time">{formatRelativeTime(msg.createdAt)}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}