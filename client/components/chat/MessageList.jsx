'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import MessageBubble from './MessageBubble';
import DateDivider from './DateDivider';
import TypingIndicator from './TypingIndicator';
import { groupMessagesByDay, dayLabel } from '@/lib/chatHelpers';

export default function MessageList({
  messages, currentUserId, permissions, hasMore, loadingMore, onLoadMore,
  typingNames, onReply, onEdit, onDelete, onReact, onPin, onForward,
}) {
  const containerRef     = useRef(null);
  const bottomRef        = useRef(null);
  const prevHeightRef    = useRef(0);
  const isPrependingRef  = useRef(false);
  // BUG FIX #8 – track previous message count to detect new-message vs prepend
  const prevMsgCountRef  = useRef(0);
  const [showJumpDown,  setShowJumpDown]  = useState(false);
  const [highlightId,   setHighlightId]   = useState(null);

  const days = groupMessagesByDay(messages);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // BUG FIX #9 – only auto-scroll to bottom when a NEW message arrives
  // (messages.length increased and we're NOT in the middle of a prepend).
  // Previously this fired after every prepend too, jumping to the bottom.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    if (isPrependingRef.current) {
      // Prepend-path: restore scroll position (handled by the next effect)
      return;
    }

    const newCount = messages.length;
    const wasAtBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    if (newCount > prevMsgCountRef.current && wasAtBottom) {
      // New message arrived and user is near bottom → scroll down
      scrollToBottom('auto');
    } else if (prevMsgCountRef.current === 0 && newCount > 0) {
      // Initial load → jump to bottom instantly
      scrollToBottom('auto');
    }

    prevMsgCountRef.current = newCount;
  }, [messages.length, scrollToBottom]);

  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    if (el.scrollTop < 80 && hasMore && !loadingMore) {
      isPrependingRef.current = true;
      prevHeightRef.current   = el.scrollHeight;
      onLoadMore?.();
    }

    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowJumpDown(distanceFromBottom > 400);
  }, [hasMore, loadingMore, onLoadMore]);

  // BUG FIX #10 – preserve scroll position after prepending older messages
  // so the viewport doesn't jump. Must run after DOM paint (layout).
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !isPrependingRef.current) return;
    const diff = el.scrollHeight - prevHeightRef.current;
    if (diff > 0) el.scrollTop += diff;
    isPrependingRef.current = false;
  }, [messages]);

  const jumpToMessage = useCallback((id) => {
    const node = document.getElementById(`msg-${id}`);
    if (node) {
      node.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setHighlightId(id);
      setTimeout(() => setHighlightId(null), 1500);
    }
  }, []);

  return (
    // BUG FIX #11 – needs flex-1 AND min-h-0 so it actually shrinks inside
    // the parent flex column and doesn't push the input off-screen.
    <div className="relative flex-1 min-h-0">
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full overflow-y-auto px-3 sm:px-6 py-4 scrollbar-thin"
      >
        {loadingMore && (
          <div className="flex justify-center py-2">
            <span className="loading loading-spinner loading-sm" />
          </div>
        )}

        {days.map((group) => (
          <div key={group.day}>
            <DateDivider label={dayLabel(group.date)} />
            {group.items.map((message, idx) => {
              const prev       = group.items[idx - 1];
              const isOwn      = (message.sender?._id || message.sender)?.toString() === currentUserId?.toString();
              const showAvatar = !prev || (prev.sender?._id || prev.sender)?.toString() !== (message.sender?._id || message.sender)?.toString();

              return (
                <div
                  key={message._id}
                  id={`msg-${message._id}`}
                  className={`transition-colors rounded-field ${highlightId === message._id ? 'bg-primary/10' : ''}`}
                >
                  <MessageBubble
                    message={message}
                    isOwn={isOwn}
                    showAvatar={showAvatar}
                    permissions={permissions}
                    onReply={onReply}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onReact={onReact}
                    onPin={onPin}
                    onForward={onForward}
                    onJumpToReply={jumpToMessage}
                  />
                </div>
              );
            })}
          </div>
        ))}

        <TypingIndicator names={typingNames} />
        <div ref={bottomRef} />
      </div>

      {showJumpDown && (
        <button
          type="button"
          onClick={() => scrollToBottom()}
          className="absolute bottom-4 right-4 btn btn-circle bg-base-100 border border-base-300 shadow-md"
          aria-label="Jump to latest message"
        >
          <ChevronDown className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
