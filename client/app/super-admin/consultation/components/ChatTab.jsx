'use client';

import React, { useState, useRef, useEffect } from 'react';

const bubbleClass = (role) => {
  switch (role) {
    case 'doctor':  return 'bg-primary/10 border border-primary/20 text-base-content self-start';
    case 'patient': return 'bg-success/10 border border-success/20 text-base-content self-end';
    case 'admin':   return 'bg-base-300 border border-base-300 text-base-content self-center';
    case 'system':  return 'alert alert-info text-xs py-1 px-2 self-center w-full';
    default:        return 'bg-base-200 border border-base-300 self-start';
  }
};

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '';

export default function ChatTab({ messages, rt, onSend, loading }) {
  const [input, setInput] = useState('');
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const submit = () => {
    const text = input.trim();
    if (!text) return;
    onSend(text);
    setInput('');
  };

  const typingNames = rt.typingUsers.map((u) => u.name || u.role).join(', ');

  return (
    <div className="flex flex-col h-full">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-2">
        {messages.map((msg) => (
          <div key={msg._id} className={`flex flex-col max-w-[85%] rounded-xl px-3 py-2 text-xs ${bubbleClass(msg.senderRole)}`}>
            <div className="flex items-center justify-between gap-2 mb-0.5">
              <span className="font-semibold capitalize opacity-70">{msg.senderRole}</span>
              <span className="text-[10px] opacity-40">{fmtTime(msg.createdAt)}</span>
            </div>
            <span className="leading-relaxed">{msg.message}</span>
          </div>
        ))}
        {messages.length === 0 && (
          <p className="text-xs text-base-content/30 text-center mt-8">No messages yet</p>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Typing indicator */}
      {typingNames && (
        <div className="px-3 py-1 text-[10px] text-base-content/40 italic">
          {typingNames} typing…
        </div>
      )}

      {/* Input */}
      <div className="flex items-end gap-2 px-3 py-3 border-t border-base-300">
        <textarea
          className="input-field flex-1 text-xs resize-none"
          rows={2}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); }
          }}
          placeholder="Admin message…"
        />
        <button
          className="btn btn-primary btn-sm self-end"
          onClick={submit}
          disabled={!input.trim() || loading}
        >
          {loading ? <span className="loading loading-xs" /> : 'Send'}
        </button>
      </div>
    </div>
  );
}