'use client';

/**
 * components/support/chat/MessageList.jsx
 * Column 3 (chat) message area. Virtualized via react-virtuoso so threads
 * with 1,000,000+ messages stay smooth. Auto-scrolls to bottom on new
 * messages, loads older history on scroll-to-top (startReached).
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useSelector } from 'react-redux';
import { Search, X } from 'lucide-react';

import MessageBubble from './MessageBubble';
import { ChatSkeleton } from '../LoadingSkeleton';
import EmptyState from '../EmptyState';
import { selectCurrentUser } from '../../../store/slices/userSlice';
import useRolePermissions from '../../../hooks/useRolePermissions';
import { MessageSquare } from 'lucide-react';

export default function MessageList({ messages, loading, hasMore, onLoadOlder, onMarkRead }) {
  const currentUser = useSelector(selectCurrentUser);
  const { permissions } = useRolePermissions();
  const virtuosoRef = useRef(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');

  // Internal notes are filtered server-side for non-admins already, but
  // we defensively filter again here in case of cached/optimistic state.
  const visibleMessages = useMemo(() => {
    const base = permissions.viewInternalNotes ? messages : messages.filter((m) => m.messageType !== 'INTERNAL_NOTE');
    if (!query.trim()) return base;
    const q = query.toLowerCase();
    return base.filter((m) => m.message?.toLowerCase().includes(q));
  }, [messages, permissions.viewInternalNotes, query]);

  // Auto-scroll to bottom whenever a new message arrives at the end (not on history load)
  useEffect(() => {
    if (!query && visibleMessages.length) {
      virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: 'smooth' });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleMessages.length]);

  // Mark the most recent inbound message as read on view
  useEffect(() => {
    const last = visibleMessages[visibleMessages.length - 1];
    if (last && last.sender?._id !== currentUser?._id) onMarkRead?.(last._id);
  }, [visibleMessages, currentUser?._id, onMarkRead]);

  return (
    <div className="flex h-full flex-col bg-base-200/40">
      <div className="flex items-center justify-between px-3 py-2 border-b border-base-300 bg-base-100">
        {searchOpen ? (
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search this conversation…"
              className="input-field pl-8 py-1.5 text-sm"
            />
          </div>
        ) : (
          <span className="text-xs font-semibold text-base-content/50">{visibleMessages.length} messages</span>
        )}
        <button
          onClick={() => {
            setSearchOpen((s) => !s);
            setQuery('');
          }}
          className="btn btn-ghost btn-circle btn-xs ml-2"
        >
          {searchOpen ? <X className="w-3.5 h-3.5" /> : <Search className="w-3.5 h-3.5" />}
        </button>
      </div>

      <div className="flex-1 min-h-0">
        {loading && visibleMessages.length === 0 && <ChatSkeleton />}

        {!loading && visibleMessages.length === 0 && (
          <EmptyState icon={MessageSquare} title="No messages yet" description="Send the first message to start the conversation." />
        )}

        {visibleMessages.length > 0 && (
          <Virtuoso
            ref={virtuosoRef}
            data={visibleMessages}
            startReached={() => hasMore && onLoadOlder?.()}
            overscan={600}
            followOutput="smooth"
            itemContent={(_, message) => (
              <MessageBubble message={message} isOwn={message.sender?._id === currentUser?._id} />
            )}
            components={{
              Header: () =>
                hasMore ? <div className="py-2 text-center text-[11px] text-base-content/40">Loading earlier messages…</div> : null,
            }}
          />
        )}
      </div>
    </div>
  );
}
