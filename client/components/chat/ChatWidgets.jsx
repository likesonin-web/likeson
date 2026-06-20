'use client';
// ─── EmojiPicker ─────────────────────────────────────────────────────────────
import { motion } from 'framer-motion';
import { ChevronDown, PhoneIncoming, PhoneOff, Video, Phone } from 'lucide-react';
import { useChat, useConversationPinned } from '@/hooks/useChat';
import { useEffect, useRef } from 'react';

const EMOJI_GROUPS = {
  'Smileys': ['😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳'],
  'Gestures': ['👍','👎','👊','✊','🤛','🤜','🤞','✌️','🤟','🤘','👌','🤌','🤏','👈','👉','👆','👇','☝️','👋','🤚','🖐️','✋','🖖','🙏','👏','🙌','🤲'],
  'Hearts': ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','💔','❤️‍🔥','❤️‍🩹','💕','💞','💓','💗','💖','💘','💝'],
  'Common': ['🔥','✨','⭐','🌟','💫','🎉','🎊','🎈','🎁','🏆','👑','💎','🚀','💯','✅','❌','⚠️','💡','🔔','📢'],
};

export function EmojiPicker({ onSelect, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose?.(); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [onClose]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.9, y: 8 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 8 }}
      transition={{ duration: 0.15 }}
      className="emoji-picker"
    >
      {Object.entries(EMOJI_GROUPS).map(([group, emojis]) => (
        <div key={group} className="emoji-group">
          <p className="emoji-group-label">{group}</p>
          <div className="emoji-grid">
            {emojis.map((e) => (
              <button key={e} onClick={() => onSelect(e)} className="emoji-btn">
                {e}
              </button>
            ))}
          </div>
        </div>
      ))}
    </motion.div>
  );
}

// ─── TypingIndicator ─────────────────────────────────────────────────────────
export function TypingIndicator({ userIds, conversation }) {
  const participants = conversation?.participants || [];
  const names = userIds
    .map((id) => participants.find((p) => (p.user?._id || p.user)?.toString() === id)?.user?.name || 'Someone')
    .slice(0, 2);

  const label = names.length === 1
    ? `${names[0]} is typing`
    : `${names.join(' & ')} are typing`;

  return (
    <div className="typing-row">
      <div className="typing-bubble">
        <span className="typing-dot" style={{ animationDelay: '0ms' }} />
        <span className="typing-dot" style={{ animationDelay: '160ms' }} />
        <span className="typing-dot" style={{ animationDelay: '320ms' }} />
      </div>
      <span className="typing-label">{label}</span>
    </div>
  );
}

// ─── ScrollToBottomBtn ───────────────────────────────────────────────────────
export function ScrollToBottomBtn({ onClick }) {
  return (
    <motion.button
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      onClick={onClick}
      className="scroll-to-bottom-btn"
    >
      <ChevronDown size={18} />
    </motion.button>
  );
}

// ─── PinnedMessagesBanner ────────────────────────────────────────────────────
export function PinnedMessagesBanner({ conversationId }) {
  const { loadPinned } = useChat();
  const pinned = useConversationPinned(conversationId);

  useEffect(() => {
    if (conversationId) loadPinned(conversationId);
  }, [conversationId]);

  if (!pinned.length) return null;
  const latest = pinned[pinned.length - 1];

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: 'auto', opacity: 1 }}
      className="pinned-banner"
    >
      <div className="pinned-accent" />
      <div className="pinned-content">
        <span className="pinned-label">📌 Pinned</span>
        <p className="pinned-text">
          {latest.type === 'text' ? latest.text?.slice(0, 80) : `[${latest.type}]`}
        </p>
      </div>
      <span className="pinned-count">{pinned.length}</span>
    </motion.div>
  );
}

// ─── EmptyState ──────────────────────────────────────────────────────────────
export function EmptyState() {
  return (
    <div className="empty-state">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 200, damping: 20 }}
        className="empty-state-inner"
      >
        <div className="empty-state-icon">💬</div>
        <h2 className="empty-state-title">Your messages</h2>
        <p className="empty-state-sub">
          Select a conversation to start chatting,<br />
          or start a new one.
        </p>
      </motion.div>
    </div>
  );
}

// ─── IncomingCallModal ───────────────────────────────────────────────────────
export function IncomingCallModal() {
  const { incomingCall, joinCall, declineCall } = useChat();
  if (!incomingCall) return null;

  const isVideo = incomingCall.type === 'video';

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="incoming-call-overlay"
    >
      <motion.div
        initial={{ scale: 0.85, y: 40 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.85, y: 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="incoming-call-card"
      >
        <div className="incoming-call-pulse" />
        <div className="incoming-call-avatar">
          {isVideo ? <Video size={28} className="text-primary" /> : <Phone size={28} className="text-primary" />}
        </div>
        <p className="incoming-call-type">{isVideo ? 'Video call' : 'Voice call'}</p>
        <h3 className="incoming-call-from">{incomingCall.initiator?.name || 'Incoming call'}</h3>

        <div className="incoming-call-actions">
          <button
            onClick={() => declineCall(incomingCall.callId)}
            className="incoming-call-decline"
          >
            <PhoneOff size={22} />
          </button>
          <button
            onClick={() => joinCall(incomingCall.callId)}
            className="incoming-call-accept"
          >
            <PhoneIncoming size={22} />
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

export default EmojiPicker;