'use client';

import { useState, useRef } from 'react';
import { Pin, Pencil, Play, FileText, MapPin, PhoneMissed, Phone, Video, Download } from 'lucide-react';
import { motion } from 'framer-motion';
import Avatar from './Avatar';
import MessageStatusIcon from './MessageStatusIcon';
import MessageActionsMenu from './MessageActionsMenu';
import { formatMessageTime, formatDuration } from '@/lib/chatHelpers';
import { useLongPress } from '@/hooks/useLongPress';

export default function MessageBubble({
  message, isOwn, showAvatar, permissions,
  onReply, onEdit, onDelete, onReact, onPin, onForward, onJumpToReply,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuPos, setMenuPos] = useState(null);
  const bubbleRef = useRef(null);

  const openMenu = (e) => {
    e?.preventDefault?.();
    const rect = bubbleRef.current?.getBoundingClientRect();
    setMenuPos(rect ? { x: isOwn ? rect.right : rect.left, y: rect.bottom } : null);
    setMenuOpen(true);
  };

  const longPress = useLongPress(openMenu);

  // System notices
  if (message.type === 'system') {
    return (
      <div className="flex justify-center my-2">
        <span className="text-[11px] px-3 py-1 rounded-full bg-base-200 text-base-content/55">
          {message.text}
        </span>
      </div>
    );
  }

  // Call log
  if (message.type === 'call_log') {
    const log = message.callLog || {};
    const missed = ['missed', 'declined', 'cancelled'].includes(log.status);
    return (
      <div className={`flex ${isOwn ? 'justify-end' : 'justify-start'} my-1`}>
        <div className="flex items-center gap-2 px-3 py-2 rounded-field bg-base-200 text-xs text-base-content/70">
          {missed ? (
            <PhoneMissed className="w-4 h-4 text-error" />
          ) : log.callType === 'video' ? (
            <Video className="w-4 h-4 text-primary" />
          ) : (
            <Phone className="w-4 h-4 text-primary" />
          )}
          <span className="capitalize">
            {log.callType} call · {missed ? log.status : formatDuration(log.duration)}
          </span>
        </div>
      </div>
    );
  }

  const deleted = message.deletedForAll || message.isDeleted;

  return (
    <div className={`flex gap-2 my-1 ${isOwn ? 'justify-end' : 'justify-start'}`}>
      {!isOwn && (
        <div className="w-8 shrink-0 self-end">
          {showAvatar && (
            <Avatar src={message.sender?.avatar} name={message.sender?.name} size="xs" />
          )}
        </div>
      )}

      <div
        className="max-w-[78%] sm:max-w-[65%] flex flex-col"
        style={{ alignItems: isOwn ? 'flex-end' : 'flex-start' }}
      >
        {!isOwn && showAvatar && message.sender?.name && (
          <span className="text-[11px] font-semibold text-primary px-1 mb-0.5">
            {message.sender.name}
          </span>
        )}

        <motion.div
          ref={bubbleRef}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          {...longPress}
          onContextMenu={openMenu}
          className={`relative group px-3 py-2 rounded-field text-sm leading-relaxed break-words cursor-pointer select-text ${
            isOwn
              ? 'bg-primary text-primary-content rounded-br-sm'
              : 'bg-base-200 text-base-content rounded-bl-sm'
          }`}
        >
          {/* Reply quote */}
          {message.replyTo && !deleted && (
            <button
              type="button"
              onClick={() => onJumpToReply?.(message.replyTo._id || message.replyTo)}
              className={`block w-full text-left mb-1.5 px-2 py-1 rounded border-l-2 text-xs ${
                isOwn
                  ? 'border-primary-content/50 bg-primary-content/10'
                  : 'border-primary bg-base-100/60'
              }`}
            >
              <span className="font-semibold block truncate">
                {message.replyTo.sender?.name || 'Message'}
              </span>
              <span className="opacity-75 block truncate">
                {message.replyTo.type === 'text'
                  ? message.replyTo.text
                  : `[${message.replyTo.type}]`}
              </span>
            </button>
          )}

          <MessageBody message={message} deleted={deleted} isOwn={isOwn} />

          {/* Meta row */}
          <div
            className={`flex items-center gap-1 mt-1 text-[10px] ${
              isOwn ? 'text-primary-content/70 justify-end' : 'text-base-content/45'
            }`}
          >
            {message.isEdited && !deleted && <Pencil className="w-2.5 h-2.5" />}
            {message.isPinned && <Pin className="w-2.5 h-2.5" />}
            <span>{formatMessageTime(message.createdAt)}</span>
            {isOwn && !deleted && <MessageStatusIcon message={message} />}
          </div>

          {/* Reactions */}
          {message.reactions?.length > 0 && (
            <div
              className={`absolute -bottom-3 ${isOwn ? 'right-2' : 'left-2'} flex bg-base-100 border border-base-300 rounded-full px-1.5 py-0.5 shadow-sm gap-0.5 z-10`}
            >
              {[...new Set(message.reactions.map((r) => r.emoji))].slice(0, 4).map((emoji) => (
                <span key={emoji} className="text-xs">{emoji}</span>
              ))}
              {message.reactions.length > 1 && (
                <span className="text-[10px] text-base-content/50 ml-0.5">
                  {message.reactions.length}
                </span>
              )}
            </div>
          )}
        </motion.div>
      </div>

      {menuOpen && (
        <MessageActionsMenu
          message={message}
          isOwn={isOwn}
          deleted={deleted}
          permissions={permissions}
          position={menuPos}
          onClose={() => setMenuOpen(false)}
          onReply={() => { onReply?.(message); setMenuOpen(false); }}
          onEdit={() => { onEdit?.(message); setMenuOpen(false); }}
          onDelete={(scope) => { onDelete?.(message, scope); setMenuOpen(false); }}
          onReact={(emoji) => { onReact?.(message, emoji); setMenuOpen(false); }}
          onPin={() => { onPin?.(message); setMenuOpen(false); }}
          onForward={() => { onForward?.(message); setMenuOpen(false); }}
        />
      )}
    </div>
  );
}

function MessageBody({ message, deleted, isOwn }) {
  if (deleted) {
    return <p className="italic opacity-60 text-sm">This message was deleted</p>;
  }

  switch (message.type) {
    case 'image':
      return (
        <div className="relative group/img">
          <img
            src={message.media?.url}
            alt={message.media?.fileName || 'photo'}
            className="rounded-field max-w-full max-h-72 object-cover cursor-pointer block"
            loading="lazy"
            onClick={() => window.open(message.media?.url, '_blank')}
          />
          <a
            href={message.media?.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-2 right-2 btn btn-circle btn-xs bg-black/40 text-white opacity-0 group-hover/img:opacity-100 transition-opacity"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-3 h-3" />
          </a>
        </div>
      );

    case 'video':
      return (
        <video
          src={message.media?.url}
          controls
          className="rounded-field max-w-full max-h-72 block"
          preload="metadata"
        />
      );

    case 'audio':
      return (
        <div className="flex items-center gap-2 min-w-[200px] py-1">
          <Play className="w-4 h-4 shrink-0 opacity-70" />
          <audio src={message.media?.url} controls className="h-8 flex-1 min-w-0" />
        </div>
      );

    case 'file':
      return (
        <a
          href={message.media?.url}
          target="_blank"
          rel="noopener noreferrer"
          download
          className={`flex items-center gap-2 px-2 py-2 rounded-field min-w-[160px] ${
            isOwn ? 'bg-primary-content/10' : 'bg-base-100'
          }`}
        >
          <FileText className="w-5 h-5 shrink-0 text-primary" />
          <div className="min-w-0">
            <p className="text-xs font-medium truncate">{message.media?.fileName || 'Download file'}</p>
            {message.media?.size && (
              <p className="text-[10px] opacity-60">
                {(message.media.size / 1024).toFixed(0)} KB
              </p>
            )}
          </div>
          <Download className="w-4 h-4 shrink-0 opacity-60 ml-auto" />
        </a>
      );

    case 'location':
      return (
        <a
          href={`https://maps.google.com/?q=${message.location?.coordinates?.[1]},${message.location?.coordinates?.[0]}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2"
        >
          <MapPin className="w-5 h-5 shrink-0 text-error" />
          <span className="text-xs underline">{message.location?.address || 'View location'}</span>
        </a>
      );

    case 'order_card':
      return (
        <div className="text-xs space-y-1">
          <p className="font-bold">Order update</p>
          <pre className="whitespace-pre-wrap break-words text-[11px] opacity-80">
            {typeof message.cardPayload === 'string'
              ? message.cardPayload
              : JSON.stringify(message.cardPayload, null, 1)}
          </pre>
        </div>
      );

    default:
      return <p className="whitespace-pre-wrap">{message.text}</p>;
  }
}
