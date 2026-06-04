'use client';

/**
 * ChatPanel.jsx — PRODUCTION GRADE
 *
 * FIX: Added a pop-up menu for the attachment button to allow users to select
 * the specific document type (Image, Document, Lab Order, Prescription).
 * This maps perfectly to the backend Mongoose enum:
 * ['text', 'image', 'file', 'prescription_preview', 'lab_order', 'system']
 */

import React, {
  useState, useRef, useEffect, useCallback, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, X, Paperclip, Image as ImageIcon,
  FlaskConical, FileText, Pill
} from 'lucide-react';
import { useDispatch, useSelector } from 'react-redux';
import { useConsultation } from '@/context/ConsultationProvider';
import {
  sendChatMessage,
  selectTypingUsers,
  selectChatMessages,
} from '@/store/slices/consultationSlice';
import {
  socketSendChat,
  socketTyping,
} from '@/services/consultationSocketService';

// ── Message type enum ─────────────────────────────────────────────────────────

const MSG_TYPES = {
  text:                 'text',
  image:                'image',
  file:                 'file',
  prescription_preview: 'prescription_preview',
  lab_order:            'lab_order',
  system:               'system',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const isImageFile = (file) => file?.type?.startsWith('image/');

const typeIcon = (type) => {
  switch (type) {
    case MSG_TYPES.image:                return <ImageIcon size={12} />;
    case MSG_TYPES.file:                 return <FileText  size={12} />;
    case MSG_TYPES.lab_order:            return <FlaskConical size={12} />;
    case MSG_TYPES.prescription_preview: return <Pill size={12} />;
    default:                             return null;
  }
};

// ── Message Bubble ────────────────────────────────────────────────────────────

const MessageBubble = memo(({ msg, isOwn }) => {
  const time = msg.sentAt
    ? new Date(msg.sentAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
    : '';

  if (msg.isDeleted) {
    return (
      <div className={`flex w-full mb-3 ${isOwn ? 'justify-end' : 'justify-start'}`}>
        <p className="text-xs italic text-base-content/40 bg-base-200 px-3 py-2 rounded-xl">
          Message deleted
        </p>
      </div>
    );
  }

  if (msg.messageType === MSG_TYPES.system) {
    return (
      <div className="flex justify-center w-full my-3">
        <span className="text-xs font-semibold px-4 py-1.5 bg-base-200 text-base-content/60 rounded-full">
          {msg.content}
        </span>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`flex flex-col w-full max-w-[82%] mb-3 ${isOwn ? 'self-end items-end ml-auto' : 'self-start items-start mr-auto'}`}
    >
      {!isOwn && (
        <span className="flex items-center gap-1 text-[0.65rem] font-semibold text-base-content/50 mb-1 ml-1 uppercase tracking-wider">
          {typeIcon(msg.messageType)}
          {msg.senderName ?? msg.senderRole ?? 'Participant'}
        </span>
      )}

      <div
        className={`relative px-4 py-2.5 text-sm shadow-sm max-w-full rounded-2xl
          ${isOwn
            ? 'bg-primary text-primary-content rounded-tr-sm'
            : 'bg-base-200 text-base-content border border-base-300 rounded-tl-sm'
          }`}
      >
        {/* Render Image */}
        {msg.messageType === MSG_TYPES.image && msg.attachmentUrl && (
          <a href={msg.attachmentUrl} target="_blank" rel="noopener noreferrer" className="block mb-2">
            <img
              src={msg.attachmentUrl}
              alt={msg.attachmentName ?? 'Image'}
              className="max-w-[220px] h-auto object-cover rounded-lg border border-base-100/20"
            />
          </a>
        )}

        {/* Render File/Lab/Prescription */}
        {[MSG_TYPES.file, MSG_TYPES.lab_order, MSG_TYPES.prescription_preview].includes(msg.messageType) && msg.attachmentUrl && (
          <a
            href={msg.attachmentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 underline underline-offset-2 mb-2 hover:opacity-80 font-medium break-all"
          >
            {typeIcon(msg.messageType)}
            <span>{msg.attachmentName || 'Document'}</span>
          </a>
        )}

        {/* Render Text Content */}
        {(msg.content && (msg.messageType === MSG_TYPES.text || !msg.messageType)) && (
          <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>
        )}

        {/* Render Caption for Attachments */}
        {msg.content && msg.messageType !== MSG_TYPES.text && (
          <p className="whitespace-pre-wrap break-words leading-relaxed mt-1.5 text-[0.8rem]">
            {msg.content}
          </p>
        )}
      </div>

      <span className={`text-[0.62rem] text-base-content/40 mt-1 ${isOwn ? 'mr-1' : 'ml-1'}`}>
        {time}
      </span>
    </motion.div>
  );
});
MessageBubble.displayName = 'MessageBubble';

// ── Typing indicator ──────────────────────────────────────────────────────────

const TypingIndicator = memo(({ users }) => {
  if (!users?.length) return null;
  const names = users.map(u => u.name || u.role).join(', ');
  return (
    <div className="flex items-center gap-2 text-xs text-base-content/50 px-2 mt-1">
      <div className="flex items-center gap-0.5">
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 bg-base-content/40 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 0.15}s` }}
          />
        ))}
      </div>
      <span className="font-medium">{names} typing…</span>
    </div>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

// ── Chat Panel ────────────────────────────────────────────────────────────────

const ChatPanel = memo(({ onClose }) => {
  const dispatch = useDispatch();
  const { consultationId, userId } = useConsultation();
  const chatMessages = useSelector(selectChatMessages);
  const typingUsers  = useSelector(selectTypingUsers);

  const [input,      setInput]      = useState('');
  const [sending,    setSending]    = useState(false);
  
  // State for file attachment
  const [attachment, setAttachment] = useState(null);
  const [selectedFileType, setSelectedFileType] = useState(MSG_TYPES.file);
  
  // UI state for attachment menu
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  const bottomRef     = useRef(null);
  const typingTimeout = useRef(null);
  const fileInputRef  = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const handleInputChange = useCallback((e) => {
    setInput(e.target.value);
    socketTyping(consultationId, true);
    clearTimeout(typingTimeout.current);
    typingTimeout.current = setTimeout(() => socketTyping(consultationId, false), 2000);
  }, [consultationId]);

  const handleFilePick = useCallback((e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    // Automatically set type to image if an image is uploaded and user chose generic 'file'
    if (isImageFile(file) && selectedFileType === MSG_TYPES.file) {
        setSelectedFileType(MSG_TYPES.image);
    }
    
    setAttachment(file);
    setShowAttachMenu(false);
    e.target.value = '';
  }, [selectedFileType]);

  const handleAttachOptionClick = (type) => {
    setSelectedFileType(type);
    
    // Configure file input based on selected type
    if (fileInputRef.current) {
        if (type === MSG_TYPES.image) {
             fileInputRef.current.accept = "image/*";
        } else {
             fileInputRef.current.accept = ".pdf,.doc,.docx,.xls,.xlsx,.txt,image/*";
        }
        fileInputRef.current.click();
    }
  };

  // ── Send — unified flow ───────────────────────────────────────────────────
  const handleSend = useCallback(async () => {
    const content = input.trim();
    if ((!content && !attachment) || sending) return;

    setSending(true);
    socketTyping(consultationId, false);
    clearTimeout(typingTimeout.current);

    try {
      if (attachment) {
        const formData = new FormData();
        formData.append('attachment', attachment);
        if (content) formData.append('content', content);
        
        // Pass the explicit file type selected by the user
        formData.append('messageType', selectedFileType);

        await dispatch(sendChatMessage({ consultationId, message: formData }));
      } else {
        socketSendChat(consultationId, content, MSG_TYPES.text);
      }

      setInput('');
      setAttachment(null);
      setSelectedFileType(MSG_TYPES.file);
    } finally {
      setSending(false);
    }
  }, [input, attachment, sending, consultationId, dispatch, selectedFileType]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  return (
    <div className="flex flex-col h-full bg-base-100 border-l border-base-300 w-full sm:w-96 shadow-2xl" role="complementary" aria-label="Chat">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5 border-b border-base-300 bg-base-100/95 backdrop-blur-md shrink-0 z-20">
        <h2 className="font-montserrat text-base font-bold text-base-content tracking-tight">Chat</h2>
        <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm" aria-label="Close chat">
          <X size={17} />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 flex flex-col scrollbar-thin bg-base-100" role="log" aria-live="polite">
        {chatMessages.length === 0 && (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-4 opacity-50">
            <Send size={28} className="text-base-content/30 mb-3" />
            <p className="text-sm font-medium text-base-content">No messages yet.</p>
          </div>
        )}
        <AnimatePresence initial={false}>
          {chatMessages.map(msg => (
            <MessageBubble
              key={msg._id}
              msg={msg}
              isOwn={msg.senderUserId === userId || msg.senderUserId?._id === userId}
            />
          ))}
        </AnimatePresence>
        <TypingIndicator users={typingUsers} />
        <div ref={bottomRef} className="h-2 shrink-0" />
      </div>

      {/* Input Section */}
      <div className="p-4 border-t border-base-300 bg-base-100 flex flex-col gap-2 relative shrink-0">
        
        {/* Attachment menu popover */}
        <AnimatePresence>
            {showAttachMenu && (
                <>
                {/* Backdrop to close menu when clicking outside */}
                <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowAttachMenu(false)}
                />
                <motion.div 
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute bottom-[calc(100%+10px)] left-4 bg-base-100 border border-base-300 shadow-xl rounded-xl p-2 z-20 flex flex-col gap-1 w-48"
                >
                    <button 
                        onClick={() => handleAttachOptionClick(MSG_TYPES.image)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-base-200 rounded-lg transition-colors text-left"
                    >
                        <ImageIcon size={16} className="text-primary" /> Image
                    </button>
                    <button 
                        onClick={() => handleAttachOptionClick(MSG_TYPES.file)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-base-200 rounded-lg transition-colors text-left"
                    >
                        <FileText size={16} className="text-info" /> Document
                    </button>
                    <button 
                        onClick={() => handleAttachOptionClick(MSG_TYPES.lab_order)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-base-200 rounded-lg transition-colors text-left"
                    >
                        <FlaskConical size={16} className="text-secondary" /> Lab Report
                    </button>
                    <button 
                        onClick={() => handleAttachOptionClick(MSG_TYPES.prescription_preview)}
                        className="flex items-center gap-3 px-3 py-2 text-sm font-medium hover:bg-base-200 rounded-lg transition-colors text-left"
                    >
                        <Pill size={16} className="text-success" /> Prescription
                    </button>
                </motion.div>
                </>
            )}
        </AnimatePresence>

        {/* Selected Attachment preview banner */}
        {attachment && (
          <div className="bg-base-200 border border-base-300 p-2 rounded-xl flex items-center gap-3 w-full mb-1">
            {isImageFile(attachment) ? (
              <img src={URL.createObjectURL(attachment)} alt="preview" className="w-10 h-10 object-cover rounded-lg border border-base-100 shrink-0" />
            ) : (
              <div className="w-10 h-10 flex items-center justify-center bg-base-100 border border-base-200 rounded-lg text-base-content/70 shrink-0">
                {typeIcon(selectedFileType)}
              </div>
            )}
            <div className="flex flex-col flex-1 overflow-hidden">
                <span className="text-sm font-semibold truncate">{attachment.name}</span>
                <span className="text-[0.65rem] text-base-content/60 uppercase tracking-wider font-bold">
                   {selectedFileType.replace('_', ' ')}
                </span>
            </div>
            
            <button className="btn btn-ghost btn-circle btn-xs text-error shrink-0" onClick={() => setAttachment(null)} aria-label="Remove attachment">
              <X size={13} />
            </button>
          </div>
        )}

        <div className="flex items-end gap-2">
            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFilePick}
            />

            {/* Attachment Button */}
            <button
                className={`btn btn-circle shrink-0 ${showAttachMenu ? 'btn-primary' : 'btn-ghost text-base-content/60 hover:text-primary hover:bg-primary/10'}`}
                onClick={() => setShowAttachMenu(!showAttachMenu)}
                aria-label="Attach file"
                disabled={sending}
            >
                <Paperclip size={17} />
            </button>

            {/* Text Input */}
            <textarea
                className="input-field min-h-[44px] max-h-32 resize-none py-2.5 px-4 scrollbar-thin flex-1 text-sm"
                placeholder={attachment ? "Add a caption..." : "Type a message… (Enter to send)"}
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                rows={1}
                aria-label="Message input"
            />

            {/* Send Button */}
            <button
                className="btn btn-primary btn-circle shrink-0"
                onClick={handleSend}
                disabled={(!input.trim() && !attachment) || sending}
                aria-label="Send"
            >
                {sending
                    ? <span className="loading loading-xs loading-spinner" />
                    : <Send size={15} className="ml-0.5" />
                }
            </button>
        </div>
      </div>
    </div>
  );
});
ChatPanel.displayName = 'ChatPanel';

export default ChatPanel;