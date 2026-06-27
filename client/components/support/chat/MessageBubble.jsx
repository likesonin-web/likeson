'use client';

/**
 * components/support/chat/MessageBubble.jsx
 * Each MESSAGE_TYPE (TEXT, IMAGE, FILE, SYSTEM, INTERNAL_NOTE, MENTION) gets
 * its own renderer per the brief — composed here since they share bubble
 * chrome (avatar, timestamp, receipts) but differ in body content.
 */
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Check, CheckCheck, FileText, Lock, Reply } from 'lucide-react';

import { cn, initials, displayName, truncate } from '../../../lib/supportutils';
import AttachmentGallery from './AttachmentGallery';

// ── Mention highlighting inside TEXT bodies ───────────────────────────────────
function renderWithMentions(text = '') {
  const parts = text.split(/(@[a-zA-Z0-9_]+)/g);
  return parts.map((part, i) =>
    part.startsWith('@') ? (
      <span key={i} className="font-semibold text-primary bg-primary/10 rounded px-1">
        {part}
      </span>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

// ── Per-type renderers ─────────────────────────────────────────────────────────

function TextBody({ message }) {
  return <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">{renderWithMentions(message.message)}</p>;
}

function ImageBody({ message }) {
  return (
    <div className="space-y-2">
      {message.message && <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>}
      <AttachmentGallery attachments={message.attachments || []} compact />
    </div>
  );
}

function FileBody({ message }) {
  return (
    <div className="space-y-2">
      {message.message && <p className="text-sm whitespace-pre-wrap break-words">{message.message}</p>}
      <AttachmentGallery attachments={message.attachments || []} compact />
    </div>
  );
}

function SystemBody({ message }) {
  return (
    <div className="w-full flex justify-center py-1">
      <span className="text-[11px] font-semibold text-base-content/40 bg-base-200 rounded-full px-3 py-1">
        {message.message}
      </span>
    </div>
  );
}

function InternalNoteBody({ message }) {
  return (
    <div className="rounded-field border border-accent/30 bg-accent/5 px-3 py-2">
      <p className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-accent mb-1">
        <Lock className="w-3 h-3" /> Internal Note
      </p>
      <p className="text-sm whitespace-pre-wrap break-words">{renderWithMentions(message.message)}</p>
      {!!message.attachments?.length && <AttachmentGallery attachments={message.attachments} compact />}
    </div>
  );
}

function MentionBody({ message }) {
  return (
    <div className="rounded-field border border-primary/30 bg-primary/5 px-3 py-2">
      <p className="text-sm whitespace-pre-wrap break-words">{renderWithMentions(message.message)}</p>
    </div>
  );
}

const BODY_RENDERERS = {
  TEXT: TextBody,
  IMAGE: ImageBody,
  FILE: FileBody,
  ATTACHMENT: FileBody,
  SYSTEM: SystemBody,
  INTERNAL_NOTE: InternalNoteBody,
  MENTION: MentionBody,
};

// ── Receipts ───────────────────────────────────────────────────────────────────

function Receipts({ message, isOwn }) {
  if (!isOwn) return null;
  const delivered = (message.deliveredTo?.length || 0) > 0;
  const read = (message.readBy?.length || 0) > 0;

  if (read) return <CheckCheck className="w-3.5 h-3.5 text-info" />;
  if (delivered) return <CheckCheck className="w-3.5 h-3.5 text-base-content/40" />;
  return <Check className="w-3.5 h-3.5 text-base-content/30" />;
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function MessageBubble({ message, isOwn, onReplyPreviewClick }) {
  if (message.messageType === 'SYSTEM') return <SystemBody message={message} />;

  const Body = BODY_RENDERERS[message.messageType] || TextBody;
  const sender = message.sender;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.18 }}
      className={cn('flex gap-2 px-4 py-1.5', isOwn ? 'justify-end' : 'justify-start')}
    >
      {!isOwn && (
        <div className="avatar self-end">
          <div className="w-7 h-7 placeholder text-[10px]">
            {sender?.avatar ? <img src={sender.avatar} alt={sender?.name} /> : <span>{initials(displayName(sender))}</span>}
          </div>
        </div>
      )}

      <div className={cn('max-w-[75%] flex flex-col gap-1', isOwn && 'items-end')}>
        {!isOwn && message.messageType === 'TEXT' && (
          <span className="text-[11px] font-semibold text-base-content/50 px-1">{displayName(sender)}</span>
        )}

        {message.replyTo && (
          <button
            onClick={() => onReplyPreviewClick?.(message.replyTo)}
            className="flex items-center gap-1.5 text-[11px] text-base-content/40 border-l-2 border-primary/40 pl-2 max-w-full"
          >
            <Reply className="w-3 h-3 shrink-0" /> {truncate(message.replyTo.message, 50)}
          </button>
        )}

        <div
          className={cn(
            'rounded-2xl px-3.5 py-2.5',
            message.messageType === 'INTERNAL_NOTE' || message.messageType === 'MENTION'
              ? 'bg-transparent p-0'
              : isOwn
              ? 'bg-primary text-primary-content rounded-br-sm'
              : 'bg-base-200 text-base-content rounded-bl-sm'
          )}
        >
          <Body message={message} />
        </div>

        <div className="flex items-center gap-1 px-1 text-[10px] text-base-content/40">
          {format(new Date(message.createdAt), 'h:mm a')}
          <Receipts message={message} isOwn={isOwn} />
        </div>
      </div>
    </motion.div>
  );
}
