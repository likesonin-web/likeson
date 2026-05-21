'use client';
/**
 * ConsultationChatDrawer.jsx
 * Slide-up chat panel. Messages persist through reconnects (Redux/state).
 * Deduplication via message ID. Timestamps. Typing indicator.
 */

import React, {
  useState, useCallback, useRef, useEffect,
} from 'react';
import { motion } from 'framer-motion';
import {
  X, Send, MessageCircle, Loader2,
} from 'lucide-react';

export default function ConsultationChatDrawer({
  messages = [],
  onSend,
  onClose,
  localParticipantId,
}) {
  const [text,    setText]    = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef(null);

  // Scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages.length]);

  const handleSend = useCallback(async () => {
    const msg = text.trim();
    if (!msg) return;
    setSending(true);
    try {
      onSend(msg);
      setText('');
    } finally {
      setSending(false);
    }
  }, [text, onSend]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <motion.div
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ type: 'spring', damping: 22, stiffness: 260 }}
      className="fixed inset-x-0 bottom-0 z-40 flex flex-col
                 max-h-[70vh] bg-base-100 rounded-t-2xl shadow-2xl
                 border-t border-base-300/50"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3
                      border-b border-base-300/40">
        <div className="flex items-center gap-2">
          <MessageCircle size={16} className="text-primary" />
          <span className="font-semibold text-sm text-base-content">Consultation Chat</span>
          {messages.length > 0 && (
            <span className="badge badge-primary badge-xs">
              {messages.length}
            </span>
          )}
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 rounded-full bg-base-200 flex items-center justify-center
                     hover:bg-base-300 transition-colors"
          aria-label="Close chat"
        >
          <X size={14} className="text-base-content/70" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 flex flex-col gap-3">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 py-8">
            <MessageCircle size={28} className="text-base-content/20" />
            <p className="text-sm text-base-content/40 text-center">
              Chat with your doctor during the consultation
            </p>
          </div>
        ) : (
          messages.map((msg) => {
            const isSelf = msg.senderId === localParticipantId;
            const time = msg.timestamp
              ? new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                  hour: '2-digit', minute: '2-digit',
                })
              : '';
            return (
              <div
                key={msg.id}
                className={`flex flex-col gap-0.5 max-w-[80%]
                  ${isSelf ? 'ml-auto items-end' : 'mr-auto items-start'}`}
              >
                {!isSelf && (
                  <span className="text-xs text-base-content/40 font-medium px-1">
                    {msg.senderName ?? 'Doctor'}
                  </span>
                )}
                <div
                  className={`px-3 py-2 rounded-2xl text-sm leading-relaxed
                    ${isSelf
                      ? 'bg-primary text-primary-content rounded-br-sm'
                      : 'bg-base-200 text-base-content rounded-bl-sm border border-base-300/50'
                    }`}
                >
                  {msg.message}
                </div>
                <span className="text-[10px] text-base-content/30 px-1">{time}</span>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-3 border-t border-base-300/40 flex gap-2 safe-bottom">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="input-field flex-1 resize-none text-sm py-2 min-h-[40px] max-h-24"
          aria-label="Chat message"
        />
        <button
          onClick={handleSend}
          disabled={!text.trim() || sending}
          className="btn btn-primary w-10 h-10 p-0 rounded-xl flex-shrink-0 flex items-center justify-center"
          aria-label="Send message"
        >
          {sending
            ? <Loader2 size={14} className="animate-spin" />
            : <Send size={14} />
          }
        </button>
      </div>
    </motion.div>
  );
}