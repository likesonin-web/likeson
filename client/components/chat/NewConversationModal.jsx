'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Search, Users, MessageSquare, Check, Plus } from 'lucide-react';
import { useChat } from '@/hooks/useChat';

export default function NewConversationModal({ onClose }) {
  const { startDM, startGroup, conversations } = useChat();
  const [mode, setMode] = useState('dm');  // 'dm' | 'group'
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [loading, setLoading] = useState(false);

  // In real app: search users via API. Here we derive from existing conversation participants.
  const knownUsers = [];
  const seen = new Set();
  for (const c of conversations) {
    for (const p of c.participants || []) {
      const uid = p.user?._id || p.user;
      if (uid && !seen.has(uid.toString())) {
        seen.add(uid.toString());
        knownUsers.push({ _id: uid, name: p.user?.name || 'User', avatar: p.user?.avatar });
      }
    }
  }

  const filtered = knownUsers.filter((u) =>
    u.name.toLowerCase().includes(query.toLowerCase())
  );

  const toggleUser = (u) => {
    setSelected((prev) =>
      prev.find((x) => x._id === u._id)
        ? prev.filter((x) => x._id !== u._id)
        : [...prev, u]
    );
  };

  const handleStart = async () => {
    if (!selected.length) return;
    setLoading(true);
    try {
      if (mode === 'dm') {
        await startDM(selected[0]._id);
      } else {
        if (!groupName.trim()) return;
        await startGroup({
          name: groupName,
          memberIds: selected.map((u) => u._id),
        });
      }
      onClose();
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="modal-overlay"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.92, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="modal-header">
          <h3 className="modal-title">New conversation</h3>
          <button onClick={onClose} className="modal-close-btn">
            <X size={18} />
          </button>
        </div>

        {/* Mode tabs */}
        <div className="modal-tabs">
          <button
            className={`modal-tab ${mode === 'dm' ? 'modal-tab-active' : ''}`}
            onClick={() => { setMode('dm'); setSelected([]); }}
          >
            <MessageSquare size={15} /> Direct
          </button>
          <button
            className={`modal-tab ${mode === 'group' ? 'modal-tab-active' : ''}`}
            onClick={() => { setMode('group'); setSelected([]); }}
          >
            <Users size={15} /> Group
          </button>
        </div>

        {/* Group name (group mode) */}
        <AnimatePresence>
          {mode === 'group' && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="modal-group-name-wrap"
            >
              <input
                className="modal-input"
                placeholder="Group name..."
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="modal-selected-chips">
            {selected.map((u) => (
              <div key={u._id} className="modal-chip">
                <span>{u.name}</span>
                <button onClick={() => toggleUser(u)}><X size={11} /></button>
              </div>
            ))}
          </div>
        )}

        {/* Search */}
        <div className="modal-search-wrap">
          <Search size={14} className="modal-search-icon" />
          <input
            className="modal-search-input"
            placeholder="Search people..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>

        {/* User list */}
        <div className="modal-user-list">
          {filtered.length === 0 && (
            <p className="modal-no-users">No users found</p>
          )}
          {filtered.map((u) => {
            const isSelected = selected.some((x) => x._id === u._id);
            return (
              <button
                key={u._id}
                className={`modal-user-item ${isSelected ? 'modal-user-item-active' : ''}`}
                onClick={() => {
                  if (mode === 'dm') setSelected([u]);
                  else toggleUser(u);
                }}
              >
                <div className="modal-user-avatar">
                  {u.avatar
                    ? <img src={u.avatar} alt={u.name} className="w-full h-full object-cover rounded-full" />
                    : <span>{u.name[0]?.toUpperCase()}</span>
                  }
                </div>
                <span className="modal-user-name">{u.name}</span>
                {isSelected && <Check size={15} className="modal-user-check" />}
              </button>
            );
          })}
        </div>

        {/* Footer */}
        <div className="modal-footer">
          <button onClick={onClose} className="btn btn-ghost btn-sm">Cancel</button>
          <button
            onClick={handleStart}
            disabled={!selected.length || (mode === 'group' && !groupName.trim()) || loading}
            className="btn btn-primary btn-sm"
          >
            {loading ? (
              <span className="loading loading-xs loading-spinner" />
            ) : (
              <>
                <Plus size={15} />
                {mode === 'dm' ? 'Open chat' : 'Create group'}
              </>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}