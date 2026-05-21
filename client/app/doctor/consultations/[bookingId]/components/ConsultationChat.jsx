'use client';
/**
 * ConsultationChat.jsx
 * In-meeting chat using VideoSDK usePubSub.
 * Zero duplicate listeners, stable callbacks.
 */

import React, { memo, useState, useEffect, useRef, useCallback } from 'react';
import { usePubSub } from '@videosdk.live/react-sdk';
import { Send, MessageSquare } from 'lucide-react';

const CHAT_TOPIC = 'CHAT';

export const ConsultationChat = memo(function ConsultationChat({ doctorName }) {
  const [messages,    setMessages]    = useState([]);
  const [inputValue,  setInputValue]  = useState('');
  const messagesEndRef = useRef(null);

  const { publish, messages: pubSubMessages } = usePubSub(CHAT_TOPIC, {
    onMessageReceived: useCallback((msg) => {
      setMessages((prev) => {
        // Dedupe by senderId + timestamp
        const key = `${msg.senderId}:${msg.timestamp}`;
        if (prev.some((m) => `${m.senderId}:${m.timestamp}` === key)) return prev;
        return [...prev, { ...msg, key }];
      });
    }, []),
  });

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = useCallback(() => {
    const text = inputValue.trim();
    if (!text) return;
    publish(text, { persist: false });
    setInputValue('');
  }, [inputValue, publish]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-2 p-3 border-b border-base-300">
        <MessageSquare size={14} className="text-primary" />
        <span className="text-sm font-bold text-base-content">Chat</span>
        {messages.length > 0 && (
          <span className="badge badge-primary badge-xs ml-auto">{messages.length}</span>
        )}
      </div>

      {/* Messages */}
      <div
        className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin"
        aria-live="polite"
        aria-label="Chat messages"
      >
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-base-content/30">
            <MessageSquare size={28} />
            <span className="text-xs">No messages yet</span>
          </div>
        )}

        {messages.map((msg, idx) => {
          const isDoctor = msg.senderName === doctorName || msg.isLocal;
          return (
            <div
              key={msg.key ?? idx}
              className={`flex flex-col gap-0.5 ${isDoctor ? 'items-end' : 'items-start'}`}
            >
              <div className="flex items-baseline gap-1.5">
                <span className={`text-[10px] font-semibold ${isDoctor ? 'text-primary' : 'text-accent'}`}>
                  {isDoctor ? 'You' : msg.senderName}
                </span>
                <span className="text-[9px] text-base-content/30">{formatTime(msg.timestamp)}</span>
              </div>
              <div
                className={`
                  max-w-[85%] px-3 py-1.5 rounded-2xl text-xs
                  ${isDoctor
                    ? 'bg-primary text-white rounded-tr-none'
                    : 'bg-base-300 text-base-content rounded-tl-none'
                  }
                `}
              >
                {msg.message}
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-base-300 flex gap-2">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          aria-label="Chat message input"
          maxLength={500}
          className="input-field flex-1 text-xs py-1.5"
        />
        <button
          onClick={handleSend}
          disabled={!inputValue.trim()}
          aria-label="Send message"
          className="btn btn-primary btn-sm px-3 disabled:opacity-40"
        >
          <Send size={14} />
        </button>
      </div>
    </div>
  );
});

export default ConsultationChat;