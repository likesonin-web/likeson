'use client';

/**
 * components/support/chat/MessageComposer.jsx
 * The reply box. Auto-resizing textarea, @mention autocomplete, drag/drop
 * + paste-image upload, character counter, Ctrl+Enter send, and per-ticket
 * draft persistence (localStorage — safe here, this is a real Next.js app,
 * not a sandboxed artifact).
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Paperclip, Smile, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';

import useTicketTyping from '../../../hooks/useTicketTyping';
import useTicketUpload from '../../../hooks/useTicketUpload';
import useMentions from '../../../hooks/useMentions';
import useRolePermissions from '../../../hooks/useRolePermissions';
import { MESSAGE_MAX_LENGTH, ALLOWED_UPLOAD_MIME_TYPES } from '../../../lib/supportconstants';
import { cn, initials } from '../../../lib/supportutils';

const EMOJI_QUICK_SET = ['🙂', '👍', '🙏', '✅', '❤️', '😕', '🚨', '🎉'];

function draftKey(ticketId, mode) {
  return `support:draft:${mode}:${ticketId}`;
}

export default function MessageComposer({ ticketId, currentUserId, onSend, mode = 'reply' }) {
  // mode: 'reply' (TEXT message) | 'note' (INTERNAL_NOTE) — composer chrome differs slightly
  const isNoteMode = mode === 'note';
  const textareaRef = useRef(null);
  const { register, handleSubmit, watch, setValue, reset } = useForm({ defaultValues: { text: '' } });
  const text = watch('text');

  const { notifyTyping } = useTicketTyping(ticketId, currentUserId);
  const { items: uploadItems, enqueueFiles } = useTicketUpload(ticketId, isNoteMode ? 'internal_note' : 'message');
  const mentions = useMentions();
  const { permissions } = useRolePermissions();
  const [showEmoji, setShowEmoji] = useState(false);

  // ── Draft persistence ────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(draftKey(ticketId, mode));
      if (saved) setValue('text', saved);
    } catch { /* ignore */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId, mode]);

  useEffect(() => {
    try {
      if (text) localStorage.setItem(draftKey(ticketId, mode), text);
      else localStorage.removeItem(draftKey(ticketId, mode));
    } catch { /* ignore */ }
  }, [text, ticketId, mode]);

  // ── Auto-resize textarea ─────────────────────────────────────────────────
  useEffect(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [text]);

  // ── Dropzone (click target is the textarea wrapper, not the whole composer) ──
  const onDrop = useCallback((files) => enqueueFiles(files), [enqueueFiles]);
  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop,
    accept: ALLOWED_UPLOAD_MIME_TYPES.reduce((acc, m) => ({ ...acc, [m]: [] }), {}),
    noClick: true,
    noKeyboard: true,
  });

  // ── Paste-image upload ───────────────────────────────────────────────────
  const handlePaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []);
    if (files.length) {
      e.preventDefault();
      enqueueFiles(files);
    }
  };

  // ── Mention detection + keyboard nav ─────────────────────────────────────
  const handleChange = (e) => {
    setValue('text', e.target.value);
    notifyTyping();
    if (permissions.createMention) mentions.detectMention(e.target.value, e.target.selectionStart);
  };

  const insertMention = (agent) => {
    const upToCaret = text.slice(0, textareaRef.current.selectionStart);
    const replaced = upToCaret.replace(/@([a-zA-Z0-9_]*)$/, `@${agent.name.replace(/\s+/g, '')} `);
    setValue('text', replaced + text.slice(textareaRef.current.selectionStart));
    mentions.closeMentions();
    textareaRef.current.focus();
  };

  const handleKeyDown = (e) => {
    if (mentions.isActive && mentions.suggestions.length) {
      if (e.key === 'ArrowDown') { e.preventDefault(); mentions.moveActive(1); return; }
      if (e.key === 'ArrowUp') { e.preventDefault(); mentions.moveActive(-1); return; }
      if (e.key === 'Enter') { e.preventDefault(); insertMention(mentions.suggestions[mentions.activeIndex]); return; }
      if (e.key === 'Escape') { mentions.closeMentions(); return; }
    }
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  const submit = handleSubmit(({ text: value }) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    if (trimmed.length > MESSAGE_MAX_LENGTH) {
      toast.error(`Message too long (max ${MESSAGE_MAX_LENGTH} characters).`);
      return;
    }
    const completedAttachments = uploadItems.filter((i) => i.status === 'done').map((i) => i.attachment?._id).filter(Boolean);
    const mentionIds = []; // resolved server-side from @name text per current backend contract

    onSend({
      message: trimmed,
      messageType: isNoteMode ? 'INTERNAL_NOTE' : completedAttachments.length ? 'ATTACHMENT' : 'TEXT',
      attachments: completedAttachments,
      mentions: mentionIds,
    });

    reset({ text: '' });
    try { localStorage.removeItem(draftKey(ticketId, mode)); } catch { /* ignore */ }
  });

  const remaining = MESSAGE_MAX_LENGTH - (text?.length || 0);

  return (
    <div {...getRootProps()} className={cn('relative border-t border-base-300 bg-base-100 p-3', isDragActive && 'bg-primary/5')}>
      <input {...getInputProps()} />

      {/* Mention autocomplete */}
      <AnimatePresence>
        {mentions.isActive && mentions.suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute bottom-full left-3 mb-2 w-64 card glass-card p-1.5 z-20"
          >
            {mentions.suggestions.map((agent, i) => (
              <button
                key={agent._id}
                onClick={() => insertMention(agent)}
                className={cn(
                  'w-full flex items-center gap-2 rounded-field px-2 py-1.5 text-left',
                  i === mentions.activeIndex ? 'bg-primary/10' : 'hover:bg-base-200'
                )}
              >
                <div className="avatar">
                  <div className="w-6 h-6 placeholder text-[10px]"><span>{initials(agent.name)}</span></div>
                </div>
                <div>
                  <p className="text-xs font-semibold">{agent.name}</p>
                  <p className="text-[10px] text-base-content/40">{mentions.roleLabel(agent.role)}</p>
                </div>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {isNoteMode && (
        <div className="flex items-center gap-1.5 text-[11px] font-bold text-accent mb-2">
          <Lock className="w-3 h-3" /> Internal note — not visible to customer or partner
        </div>
      )}

      {uploadItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {uploadItems.map((item) => (
            <span key={item.localId} className="badge badge-sm badge-secondary gap-1">
              <Paperclip className="w-3 h-3" /> {item.fileName}
              {item.status === 'uploading' && <span className="opacity-60">{item.progress}%</span>}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-end gap-2">
        <textarea
          ref={(el) => {
            textareaRef.current = el;
            register('text').ref(el);
          }}
          value={text}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          rows={1}
          placeholder={isNoteMode ? 'Write an internal note…' : 'Type a message… (Ctrl+Enter to send)'}
          className="input-field flex-1 resize-none max-h-40"
        />

        <button type="button" onClick={openFilePicker} className="btn btn-ghost btn-circle">
          <Paperclip className="w-4 h-4" />
        </button>

        <div className="relative">
          <button type="button" onClick={() => setShowEmoji((s) => !s)} className="btn btn-ghost btn-circle">
            <Smile className="w-4 h-4" />
          </button>
          <AnimatePresence>
            {showEmoji && (
              <motion.div
                initial={{ opacity: 0, y: 6, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 6, scale: 0.95 }}
                className="absolute bottom-full right-0 mb-2 card glass-card p-2 flex gap-1 z-20"
              >
                {EMOJI_QUICK_SET.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => {
                      setValue('text', `${text}${emoji}`);
                      setShowEmoji(false);
                    }}
                    className="text-lg hover:scale-125 transition-transform"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileTap={{ scale: 0.92 }}
          onClick={submit}
          disabled={!text?.trim()}
          className={cn('btn btn-circle', isNoteMode ? 'btn-accent' : 'btn-primary')}
        >
          <Send className="w-4 h-4" />
        </motion.button>
      </div>

      <div className="flex justify-end mt-1">
        <span className={cn('text-[10px]', remaining < 100 ? 'text-error' : 'text-base-content/30')}>{remaining}</span>
      </div>
    </div>
  );
}
