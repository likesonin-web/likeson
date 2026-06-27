'use client';

import { useMemo, useState } from 'react';
import { Search, SquarePen, Users, MessageCircle, Filter, PhoneCall } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ConversationItem from './ConversationItem';
import EmptyState from './EmptyState';
import { getConversationDisplay } from '@/lib/chatHelpers';

const FILTERS = [
  { key: 'all', label: 'All', icon: MessageCircle },
  { key: 'unread', label: 'Unread', icon: Filter },
  { key: 'group', label: 'Groups', icon: Users },
];

export default function ConversationSidebar({
  conversations, activeConversationId, currentUser, onSelect, onNewChat, onOpenCallHistory, loading,
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');

  const filtered = useMemo(() => {
    let list = conversations;
    if (filter === 'unread') list = list.filter((c) => c.unreadCount > 0);
    if (filter === 'group') list = list.filter((c) => c.type === 'group');

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => getConversationDisplay(c, currentUser?._id).name.toLowerCase().includes(q));
    }
    return list;
  }, [conversations, filter, query, currentUser]);

  return (
    <div className="flex flex-col h-full bg-base-100 border-r border-base-300">
      <div className="flex items-center justify-between px-4 pt-4 pb-3">
        <h2 className="text-xl font-extrabold font-display">Chats</h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onOpenCallHistory}
            className="btn btn-ghost btn-circle"
            aria-label="Call history"
          >
            <PhoneCall className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            className="btn btn-primary btn-circle"
            aria-label="Start new conversation"
          >
            <SquarePen className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="px-4 pb-3">
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search conversations"
            className="input-field pl-9"
          />
        </div>
      </div>

      <div className="flex gap-2 px-4 pb-3 overflow-x-auto scrollbar-thin">
        {FILTERS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
              filter === key ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}
          >
            <Icon className="w-3.5 h-3.5" /> {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
        {loading ? (
          <div className="space-y-2 px-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-2 py-2">
                <div className="skeleton w-11 h-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/2 rounded" />
                  <div className="skeleton h-2.5 w-3/4 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={MessageCircle}
            title="No conversations"
            subtitle={query ? 'Try a different search term.' : 'Start a new chat to get going.'}
          />
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((c) => (
              <motion.div key={c._id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <ConversationItem
                  conversation={c}
                  isActive={c._id === activeConversationId}
                  currentUserId={currentUser?._id}
                  onSelect={onSelect}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
