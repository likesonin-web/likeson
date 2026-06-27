'use client';

import { useRef } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { Reply, Pencil, Trash2, Pin, PinOff, Forward, Copy } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

export default function MessageActionsMenu({
  message, isOwn, deleted, permissions, position,
  onClose, onReply, onEdit, onDelete, onReact, onPin, onForward,
}) {
  const ref = useRef(null);
  useClickOutside(ref, onClose);

  if (typeof document === 'undefined') return null;

  const canEdit = !deleted && permissions?.canEditMessage?.(message);
  const canDelAll = !deleted && permissions?.canDeleteForAll?.(message);
  const canDelMe = !deleted && permissions?.canDeleteForMe?.(message);
  const canPin = !deleted && permissions?.canPinMessage;
  const canReact = !deleted && permissions?.canReact;
  const canForward = !deleted && permissions?.canForward;
  const canReply = !deleted && permissions?.canReply;

  const viewportW = typeof window !== 'undefined' ? window.innerWidth : 400;
  const viewportH = typeof window !== 'undefined' ? window.innerHeight : 800;

  const style = position
    ? {
        position: 'fixed',
        top: Math.min(position.y + 6, viewportH - 260),
        left: isOwn ? Math.max(position.x - 220, 8) : Math.min(position.x, viewportW - 230),
      }
    : { position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%,-50%)' };

  return createPortal(
    <motion.div
      ref={ref}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      style={style}
      className="z-50 w-56 rounded-box bg-base-100 border border-base-300 shadow-lg overflow-hidden"
    >
      {canReact && (
        <div className="flex justify-between px-2 py-2 border-b border-base-300">
          {REACTION_EMOJIS.map((emoji) => (
            <button key={emoji} type="button" onClick={() => onReact(emoji)} className="text-lg hover:scale-125 transition-transform">
              {emoji}
            </button>
          ))}
        </div>
      )}

      <ul className="py-1 text-sm">
        {canReply && <MenuItem icon={Reply} label="Reply" onClick={onReply} />}
        {canForward && <MenuItem icon={Forward} label="Forward" onClick={onForward} />}
        {message.type === 'text' && !deleted && (
          <MenuItem
            icon={Copy}
            label="Copy text"
            onClick={() => {
              navigator.clipboard?.writeText(message.text || '');
              onClose();
            }}
          />
        )}
        {canPin && <MenuItem icon={message.isPinned ? PinOff : Pin} label={message.isPinned ? 'Unpin' : 'Pin'} onClick={onPin} />}
        {canEdit && <MenuItem icon={Pencil} label="Edit" onClick={onEdit} />}
        {canDelMe && <MenuItem icon={Trash2} label="Delete for me" tone="error" onClick={() => onDelete('for_me')} />}
        {canDelAll && <MenuItem icon={Trash2} label="Delete for everyone" tone="error" onClick={() => onDelete('for_all')} />}
      </ul>
    </motion.div>,
    document.body,
  );
}

function MenuItem({ icon: Icon, label, onClick, tone }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className={`w-full flex items-center gap-2.5 px-3 py-2 hover:bg-base-200 transition-colors ${
          tone === 'error' ? 'text-error' : 'text-base-content'
        }`}
      >
        <Icon className="w-4 h-4" />
        {label}
      </button>
    </li>
  );
}
