'use client';
import { useEffect, useRef, useCallback, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft, Phone, Video, Search, MoreVertical,
  Info, Pin, Image as ImageIcon, ChevronDown,
} from 'lucide-react';
import { useChat, useConversationMessages, useConversationMessagesLoading, useConversationHasMore, useConversationTyping } from '@/hooks/useChat';
import MessageBubble from './MessageBubble';
import MessageInput from './MessageInput';
import ChatHeader from './ChatHeader';
import PinnedMessagesBanner from './ChatWidgets';
import TypingIndicator from './ChatWidgets';
import ScrollToBottomBtn from './ChatWidgets';

export default function ChatWindow({ conversation, onBack }) {
  const {
    markAsRead,
    loadMoreMessages,
    currentUser,
    selectMessagesCursor,
    activeConversationId,
  } = useChat();

  const messages = useConversationMessages(conversation._id);
  const loading  = useConversationMessagesLoading(conversation._id);
  const hasMore  = useConversationHasMore(conversation._id);
  const typing   = useConversationTyping(conversation._id);

  const bottomRef  = useRef(null);
  const containerRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const isFirstLoad = useRef(true);

  // Mark read when window opens / messages arrive
  useEffect(() => {
    if (conversation._id) markAsRead(conversation._id);
  }, [conversation._id, messages.length]);

  // Auto-scroll to bottom on first load and new messages (if near bottom)
  useEffect(() => {
    if (!containerRef.current) return;
    const el = containerRef.current;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;

    if (isFirstLoad.current || distFromBottom < 200) {
      bottomRef.current?.scrollIntoView({ behavior: isFirstLoad.current ? 'instant' : 'smooth' });
      isFirstLoad.current = false;
    }
  }, [messages.length]);

  // Infinite scroll - load more on scroll to top
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 400);

    if (el.scrollTop < 80 && hasMore && !loading) {
      const oldestId = messages[0]?._id;
      if (oldestId) loadMoreMessages(conversation._id, oldestId);
    }
  }, [hasMore, loading, messages, conversation._id, loadMoreMessages]);

  const scrollToBottom = () => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="chat-window">
      {/* Header */}
      <ChatHeader
        conversation={conversation}
        currentUserId={currentUser?._id}
        onBack={onBack}
        onSearchToggle={() => setSearchOpen((v) => !v)}
        searchOpen={searchOpen}
      />

      {/* Pinned messages */}
      <PinnedMessagesBanner conversationId={conversation._id} />

      {/* Messages area */}
      <div
        ref={containerRef}
        className="chat-messages-area"
        onScroll={handleScroll}
      >
        {/* Load more indicator */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="chat-loading-more"
            >
              <div className="loading loading-sm loading-spinner" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* No messages */}
        {messages.length === 0 && !loading && (
          <div className="chat-no-messages">
            <div className="chat-no-messages-icon">💬</div>
            <p className="chat-no-messages-text">
              Say hello! Start the conversation.
            </p>
          </div>
        )}

        {/* Messages */}
        <div className="chat-messages-list">
          {messages.map((msg, idx) => {
            const prev = messages[idx - 1];
            const showDate = !prev || !isSameDay(prev.createdAt, msg.createdAt);
            const isMine = (msg.sender?._id || msg.sender)?.toString() === currentUser?._id?.toString();
            const showAvatar = !isMine && (
              !messages[idx + 1] ||
              (messages[idx + 1].sender?._id || messages[idx + 1].sender)?.toString() !==
              (msg.sender?._id || msg.sender)?.toString()
            );

            return (
              <div key={msg._id}>
                {showDate && <DateDivider date={msg.createdAt} />}
                <MessageBubble
                  message={msg}
                  isMine={isMine}
                  showAvatar={showAvatar}
                  conversation={conversation}
                  onReply={() => setReplyTo(msg)}
                  currentUserId={currentUser?._id}
                />
              </div>
            );
          })}

          {/* Typing indicator */}
          <AnimatePresence>
            {typing.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
              >
                <TypingIndicator userIds={typing} conversation={conversation} />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom btn */}
      <AnimatePresence>
        {showScrollBtn && (
          <ScrollToBottomBtn onClick={scrollToBottom} />
        )}
      </AnimatePresence>

      {/* Input */}
      <MessageInput
        conversation={conversation}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        currentUser={currentUser}
      />
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isSameDay(a, b) {
  if (!a || !b) return false;
  const da = new Date(a);
  const db = new Date(b);
  return da.toDateString() === db.toDateString();
}

function DateDivider({ date }) {
  const label = formatDateLabel(date);
  return (
    <div className="chat-date-divider">
      <div className="chat-date-line" />
      <span className="chat-date-label">{label}</span>
      <div className="chat-date-line" />
    </div>
  );
}

function formatDateLabel(date) {
  const d = new Date(date);
  const now = new Date();
  const diff = Math.floor((now - d) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Yesterday';
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
}