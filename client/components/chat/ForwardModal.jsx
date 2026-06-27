'use client';

import { useState, useMemo } from 'react';
import { Search } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { getConversationDisplay } from '@/lib/chatHelpers';

export default function ForwardModal({ open, onClose, conversations = [], currentUserId, message, onForward }) {
  const [query, setQuery] = useState('');
  const [sendingId, setSendingId] = useState(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return conversations;
    return conversations.filter((c) => getConversationDisplay(c, currentUserId).name.toLowerCase().includes(q));
  }, [conversations, query, currentUserId]);

  const handleForward = async (conversationId) => {
    setSendingId(conversationId);
    try {
      await onForward(message._id, conversationId);
      onClose();
    } finally {
      setSendingId(null);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Forward message" maxWidth="max-w-md">
      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search conversations" className="input-field pl-9" />
      </div>
      <div className="space-y-1 max-h-80 overflow-y-auto scrollbar-thin">
        {filtered.map((c) => {
          const display = getConversationDisplay(c, currentUserId);
          return (
            <button
              key={c._id}
              type="button"
              disabled={sendingId === c._id}
              onClick={() => handleForward(c._id)}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-field hover:bg-base-200 text-left disabled:opacity-50"
            >
              <Avatar src={display.avatar} name={display.name} size="sm" />
              <span className="text-sm font-semibold truncate flex-1">{display.name}</span>
              {sendingId === c._id && <span className="loading loading-spinner loading-xs" />}
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
