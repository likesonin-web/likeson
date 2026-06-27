'use client';

import { useState, useMemo } from 'react';
import { Search, Users, User, Check } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';

/**
 * `users` = people the current user is allowed to message (see
 * ChatManagement's `directoryUsers` prop doc for where this should come from).
 */
export default function NewConversationModal({ open, onClose, users = [], onStartDirect, onStartGroup }) {
  const [tab, setTab] = useState('direct');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const filtered = useMemo(
    () => users.filter((u) => u.name?.toLowerCase().includes(query.trim().toLowerCase())),
    [users, query],
  );

  const reset = () => {
    setSelected([]);
    setGroupName('');
    setQuery('');
    setTab('direct');
  };

  const toggleSelect = (userId) =>
    setSelected((prev) => (prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]));

  const handleDirect = async (userId) => {
    setSubmitting(true);
    try {
      await onStartDirect(userId);
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleGroup = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    setSubmitting(true);
    try {
      await onStartGroup({ name: groupName.trim(), memberIds: selected });
      reset();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} title="New conversation" maxWidth="max-w-lg">
      <div className="flex gap-2 mb-4">
        <TabButton active={tab === 'direct'} icon={User} label="Direct message" onClick={() => setTab('direct')} />
        <TabButton active={tab === 'group'} icon={Users} label="New group" onClick={() => setTab('group')} />
      </div>

      {tab === 'group' && (
        <input value={groupName} onChange={(e) => setGroupName(e.target.value)} placeholder="Group name" className="input-field mb-3" />
      )}

      <div className="relative mb-3">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search people" className="input-field pl-9" />
      </div>

      <div className="space-y-1 max-h-72 overflow-y-auto scrollbar-thin">
        {filtered.length === 0 && <p className="text-center text-sm text-base-content/50 py-6">No matching people found.</p>}
        {filtered.map((u) => {
          const isSelected = selected.includes(u._id);
          return (
            <button
              key={u._id}
              type="button"
              disabled={submitting}
              onClick={() => (tab === 'direct' ? handleDirect(u._id) : toggleSelect(u._id))}
              className="w-full flex items-center gap-3 px-2 py-2 rounded-field hover:bg-base-200 transition-colors text-left disabled:opacity-50"
            >
              <Avatar src={u.avatar} name={u.name} size="sm" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold truncate">{u.name}</p>
                <p className="text-xs text-base-content/50 capitalize truncate">{u.role}</p>
              </div>
              {tab === 'group' && (
                <span className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${isSelected ? 'bg-primary border-primary' : 'border-base-300'}`}>
                  {isSelected && <Check className="w-3 h-3 text-primary-content" />}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {tab === 'group' && (
        <button
          type="button"
          onClick={handleGroup}
          disabled={!groupName.trim() || selected.length === 0 || submitting}
          className="btn btn-primary w-full mt-4"
        >
          Create group ({selected.length} selected)
        </button>
      )}
    </Modal>
  );
}

function TabButton({ active, icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-field text-sm font-semibold transition-colors ${
        active ? 'bg-primary text-primary-content' : 'bg-base-200 text-base-content/60'
      }`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
