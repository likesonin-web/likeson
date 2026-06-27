'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, X, Loader2 } from 'lucide-react';
import { useChat, useConversationSearchResults } from '@/hooks/useChat';

export default function SearchPanel({ conversationId, onClose, onJump }) {
  const { searchMessages, searchLoading, clearSearchResults } = useChat();
  const results = useConversationSearchResults(conversationId);
  const [query, setQuery] = useState('');
  const debounceRef = useRef(null);

  useEffect(() => () => clearSearchResults(), []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim()) return;
    debounceRef.current = setTimeout(() => {
      searchMessages(conversationId, query.trim());
    }, 350);
    return () => clearTimeout(debounceRef.current);
  }, [query, conversationId, searchMessages]);

  return (
    <div className="flex-1 min-h-0 flex flex-col">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-base-300">
        <Search className="w-4 h-4 text-base-content/40" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search messages in this chat"
          className="flex-1 bg-transparent outline-none text-sm"
        />
        {searchLoading && <Loader2 className="w-4 h-4 animate-spin text-base-content/40" />}
        <button type="button" onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close search">
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {results.length === 0 && query.trim() && !searchLoading && (
          <p className="text-center text-sm text-base-content/50 py-8">No messages found.</p>
        )}
        {results.map((msg) => (
          <button
            key={msg._id}
            type="button"
            onClick={() => { onJump(msg._id); onClose(); }}
            className="w-full text-left px-4 py-3 border-b border-base-300/60 hover:bg-base-200 transition-colors"
          >
            <p className="text-xs font-semibold text-primary">{msg.sender?.name}</p>
            <p className="text-sm truncate">{msg.type === 'text' ? msg.text : `[${msg.type}]`}</p>
            <p className="text-[11px] text-base-content/45">{new Date(msg.createdAt).toLocaleString()}</p>
          </button>
        ))}
      </div>
    </div>
  );
}
