'use client';

import { motion } from 'framer-motion';
import { Pin, BellOff, Users, CheckCheck } from 'lucide-react';
import Avatar from './Avatar';
import { getConversationDisplay, formatListTimestamp, MESSAGE_TYPE_LABEL } from '@/lib/chatHelpers';

export default function ConversationItem({ conversation, isActive, currentUserId, onSelect }) {
  const display = getConversationDisplay(conversation, currentUserId);
  const last = conversation.lastMessage;

  const isMuted = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() === currentUserId?.toString(),
  )?.isMuted;

  const isOwnLast = (last?.sender?._id || last?.sender)?.toString() === currentUserId?.toString();
  const preview = last ? (last.type === 'text' ? last.text : MESSAGE_TYPE_LABEL[last.type] || 'Message') : 'No messages yet';

  return (
    <motion.button
      type="button"
      onClick={() => onSelect(conversation._id)}
      whileTap={{ scale: 0.98 }}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-field text-left transition-colors ${
        isActive ? 'bg-primary/10' : 'hover:bg-base-200'
      }`}
    >
      <Avatar src={display.avatar} name={display.name} size="md" online={conversation.type === 'direct' ? display.online : undefined} />

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="font-semibold text-sm truncate text-base-content">{display.name}</span>
          <span className="text-[11px] text-base-content/45 shrink-0">
            {formatListTimestamp(last?.sentAt || conversation.updatedAt)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <span className="text-xs text-base-content/55 truncate flex items-center gap-1">
            {conversation.type === 'group' && <Users className="w-3 h-3 shrink-0" />}
            {isOwnLast && <CheckCheck className="w-3.5 h-3.5 shrink-0 text-primary" />}
            {preview}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            {conversation.isPinned && <Pin className="w-3 h-3 text-base-content/40" />}
            {isMuted && <BellOff className="w-3 h-3 text-base-content/40" />}
            {conversation.unreadCount > 0 && (
              <span className="min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary text-primary-content text-[11px] font-bold flex items-center justify-center">
                {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  );
}
