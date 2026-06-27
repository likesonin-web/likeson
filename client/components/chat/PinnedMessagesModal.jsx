'use client';

import { PinOff } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { formatMessageTime } from '@/lib/chatHelpers';

export default function PinnedMessagesModal({ open, onClose, messages = [], canUnpin, onUnpin, onJump }) {
  return (
    <Modal open={open} onClose={onClose} title={`Pinned messages (${messages.length})`} maxWidth="max-w-md">
      {messages.length === 0 ? (
        <p className="text-center text-sm text-base-content/50 py-8">No pinned messages yet.</p>
      ) : (
        <div className="space-y-2">
          {messages.map((msg) => (
            <div key={msg._id} className="flex items-start gap-3 p-3 rounded-field bg-base-200">
              <Avatar src={msg.sender?.avatar} name={msg.sender?.name} size="xs" />
              <button type="button" onClick={() => { onJump(msg._id); onClose(); }} className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-primary">{msg.sender?.name}</p>
                <p className="text-sm truncate">{msg.type === 'text' ? msg.text : `[${msg.type}]`}</p>
                <p className="text-[11px] text-base-content/45">{formatMessageTime(msg.createdAt)}</p>
              </button>
              {canUnpin && (
                <button type="button" onClick={() => onUnpin(msg._id)} aria-label="Unpin">
                  <PinOff className="w-4 h-4 text-base-content/40" />
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
