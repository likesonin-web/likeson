'use client';
import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Plus, Users, MessageSquare, MoreVertical,
  Archive, Volume2, VolumeX, Trash2, Edit3, Phone, Video,
  Filter, X, ChevronDown,
} from 'lucide-react';
import { useChat } from '@/hooks/useChat';
import ConversationItem from './ConversationItem';
import NewConversationModal from './NewConversationModal';

const FILTERS = ['all', 'direct', 'group', 'unread'];

export default function ConversationList({ onSelect }) {
  const {
    conversations,
    conversationsLoading,
    totalUnread,
    selectConversation,
    activeConversationId,
    currentUser,
  } = useChat();

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [showNew, setShowNew] = useState(false);
  const searchRef = useRef(null);

  const filtered = conversations.filter((c) => {
    const matchSearch = search
      ? (c.name || c.participants?.map((p) => p.user?.name).join(' '))
          ?.toLowerCase()
          .includes(search.toLowerCase())
      : true;

    const matchFilter =
      filter === 'all' ? true :
      filter === 'unread' ? (c.unreadCount || 0) > 0 :
      c.type === filter;

    return matchSearch && matchFilter;
  });

  const handleSelect = useCallback((id) => {
    selectConversation(id);
    onSelect?.();
  }, [selectConversation, onSelect]);

  return (
    <div className="conversation-list-panel">
      {/* Header */}
      <div className="conv-list-header">
        <div className="conv-list-title-row">
          <div>
            <h1 className="conv-list-heading">Messages</h1>
            {totalUnread > 0 && (
              <span className="conv-list-unread-pill">{totalUnread}</span>
            )}
          </div>
          <button
            onClick={() => setShowNew(true)}
            className="btn-icon-primary"
            aria-label="New conversation"
          >
            <Plus size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="conv-search-wrap">
          <Search size={15} className="conv-search-icon" />
          <input
            ref={searchRef}
            className="conv-search-input"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <AnimatePresence>
            {search && (
              <motion.button
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                exit={{ scale: 0 }}
                onClick={() => setSearch('')}
                className="conv-search-clear"
              >
                <X size={13} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Filter chips */}
        <div className="conv-filter-row">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`conv-filter-chip ${filter === f ? 'conv-filter-chip-active' : ''}`}
            >
              {f === 'all' && 'All'}
              {f === 'direct' && 'Direct'}
              {f === 'group' && 'Groups'}
              {f === 'unread' && (
                <>
                  Unread
                  {totalUnread > 0 && (
                    <span className="conv-filter-badge">{totalUnread}</span>
                  )}
                </>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <div className="conv-list-scroll">
        {conversationsLoading && filtered.length === 0 ? (
          <div className="conv-list-skeletons">
            {[...Array(7)].map((_, i) => (
              <div key={i} className="conv-skeleton-item">
                <div className="conv-skeleton-avatar" />
                <div className="conv-skeleton-lines">
                  <div className="conv-skeleton-line conv-skeleton-line-lg" />
                  <div className="conv-skeleton-line conv-skeleton-line-sm" />
                </div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="conv-list-empty">
            <MessageSquare size={32} className="conv-list-empty-icon" />
            <p className="conv-list-empty-text">
              {search ? 'No results found' : 'No conversations yet'}
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {filtered.map((convo, idx) => (
              <motion.div
                key={convo._id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ delay: idx * 0.02 }}
              >
                <ConversationItem
                  conversation={convo}
                  currentUserId={currentUser?._id}
                  isActive={convo._id === activeConversationId}
                  onSelect={() => handleSelect(convo._id)}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* New conversation modal */}
      <AnimatePresence>
        {showNew && <NewConversationModal onClose={() => setShowNew(false)} />}
      </AnimatePresence>
    </div>
  );
}