'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Send, Paperclip, X, Pencil, Mic,
  Film, Music, FileText, ImageIcon,
} from 'lucide-react';

const ACCEPTED = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/quicktime,video/webm',
  audio: 'audio/mpeg,audio/ogg,audio/wav,audio/webm,audio/mp4',
  file:  'application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
};

export default function MessageInput({
  disabled, disabledReason, replyTo, editingMessage, uploadProgress,
  onSend, onSendMedia, onTyping, onCancelReply, onCancelEdit,
}) {
  const [text, setText] = useState('');
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSeconds, setRecordSeconds] = useState(0);

  const fileInputRef    = useRef(null);
  const textareaRef     = useRef(null);
  const attachMenuRef   = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioChunksRef  = useRef([]);
  const recordTimerRef  = useRef(null);

  // BUG FIX #1 – restore edit text when editingMessage changes
  useEffect(() => {
    if (editingMessage) setText(editingMessage.text || '');
    else setText('');
  }, [editingMessage?._id]); // key on _id so changing conversations clears it

  // Auto-resize textarea (max ~5 lines)
  useEffect(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight, 120)}px`;
  }, [text]);

  // Close attach menu on outside click
  useEffect(() => {
    const handler = (e) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const submit = useCallback(() => {
    const trimmed = text.trim();
    if (!trimmed) return;
    onSend(trimmed);
    setText('');
    // reset height
    if (textareaRef.current) textareaRef.current.style.height = 'auto';
  }, [text, onSend]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const openFilePicker = (accept) => {
    if (fileInputRef.current) {
      fileInputRef.current.accept = accept;
      fileInputRef.current.click();
    }
    setAttachMenuOpen(false);
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (file) onSendMedia(file);
    e.target.value = '';
  };

  // ── Audio recording ──────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        onSendMedia(file);
        setRecordSeconds(0);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
      recordTimerRef.current = setInterval(() => setRecordSeconds((s) => s + 1), 1000);
    } catch {
      alert('Microphone permission denied.');
    }
  }, [onSendMedia]);

  const stopRecording = useCallback(() => {
    mediaRecorderRef.current?.stop();
    clearInterval(recordTimerRef.current);
    setRecording(false);
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream?.getTracks().forEach((t) => t.stop());
    }
    clearInterval(recordTimerRef.current);
    audioChunksRef.current = [];
    setRecording(false);
    setRecordSeconds(0);
  }, []);

  const fmtSecs = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  // ── Disabled state ────────────────────────────────────────────────
  if (disabled) {
    return (
      <div className="px-4 py-3 border-t border-base-300 bg-base-200 text-center text-sm text-base-content/55 shrink-0">
        {disabledReason || 'You cannot send messages in this conversation.'}
      </div>
    );
  }

  // ── Recording UI ─────────────────────────────────────────────────
  if (recording) {
    return (
      // BUG FIX #2 – shrink-0 keeps it at bottom of flex column, no 'fixed'
      <div className="border-t border-base-300 bg-base-100 shrink-0">
        <div className="flex items-center gap-3 px-3 sm:px-4 py-3">
          <button type="button" onClick={cancelRecording} className="btn btn-ghost btn-circle shrink-0 text-error" aria-label="Cancel recording">
            <X className="w-5 h-5" />
          </button>
          <div className="flex-1 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-error animate-pulse" />
            <span className="text-sm font-semibold text-error">{fmtSecs(recordSeconds)}</span>
            <span className="text-xs text-base-content/50">Recording…</span>
          </div>
          <button type="button" onClick={stopRecording} className="btn btn-primary btn-circle shrink-0" aria-label="Send voice message">
            <Send className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  }

  return (
    // BUG FIX #3 – was `border-t fixed border-base-300 bg-base-100`
    // 'fixed' with no top/left/right makes it jump to top-left corner and
    // overlap the message list. Use shrink-0 so it stays pinned to the
    // bottom of the parent flex column instead.
    <div className="border-t border-base-300 bg-base-100 shrink-0">
      {/* Reply / Edit banner */}
      {(replyTo || editingMessage) && (
        <div className="flex items-center justify-between gap-2 px-4 pt-2">
          <div className="flex items-center gap-2 min-w-0 border-l-2 border-primary pl-2">
            {editingMessage && <Pencil className="w-3.5 h-3.5 text-primary shrink-0" />}
            <div className="min-w-0">
              <p className="text-xs font-semibold text-primary">
                {editingMessage ? 'Editing message' : `Replying to ${replyTo?.sender?.name || ''}`}
              </p>
              <p className="text-xs text-base-content/55 truncate max-w-[220px]">
                {(editingMessage || replyTo)?.text || `[${(editingMessage || replyTo)?.type}]`}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={editingMessage ? onCancelEdit : onCancelReply}
            className="btn btn-ghost btn-circle btn-sm"
            aria-label="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Upload progress */}
      {uploadProgress > 0 && uploadProgress < 100 && (
        <div className="px-4 pt-2">
          <div className="w-full h-1 bg-base-300 rounded-full overflow-hidden">
            <div className="h-full bg-primary transition-all" style={{ width: `${uploadProgress}%` }} />
          </div>
          <p className="text-[10px] text-base-content/40 mt-0.5 text-right">{uploadProgress}%</p>
        </div>
      )}

      <div className="flex items-end gap-2 px-3 sm:px-4 py-3">
        {/* Hidden file input */}
        <input ref={fileInputRef} type="file" className="hidden" onChange={handleFile} />

        {/* Attach popup */}
        <div className="relative shrink-0" ref={attachMenuRef}>
          <button
            type="button"
            onClick={() => setAttachMenuOpen((v) => !v)}
            className={`btn btn-ghost btn-circle ${attachMenuOpen ? 'text-primary' : ''}`}
            aria-label="Attach file"
          >
            <Paperclip className="w-5 h-5" />
          </button>

          {attachMenuOpen && (
            <div className="absolute bottom-full left-0 mb-2 w-44 bg-base-100 border border-base-300 rounded-box shadow-lg overflow-hidden py-1 z-20">
              <AttachRow icon={ImageIcon} label="Photo"    onClick={() => openFilePicker(ACCEPTED.image)} />
              <AttachRow icon={Film}      label="Video"    onClick={() => openFilePicker(ACCEPTED.video)} />
              <AttachRow icon={Music}     label="Audio"    onClick={() => openFilePicker(ACCEPTED.audio)} />
              <AttachRow icon={FileText}  label="Document" onClick={() => openFilePicker(ACCEPTED.file)}  />
            </div>
          )}
        </div>

        <textarea
          ref={textareaRef}
          rows={1}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            onTyping?.(true);
          }}
          onBlur={() => onTyping?.(false)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message"
          className="flex-1 resize-none py-2 px-3 bg-base-200 rounded-full text-sm outline-none max-h-32 leading-relaxed"
        />

        {text.trim() ? (
          <button
            type="button"
            onClick={submit}
            className="btn btn-primary btn-circle shrink-0"
            aria-label={editingMessage ? 'Save edit' : 'Send message'}
          >
            <Send className="w-4 h-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={startRecording}
            className="btn btn-ghost btn-circle shrink-0"
            aria-label="Record voice message"
          >
            <Mic className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
}

function AttachRow({ icon: Icon, label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-base-200 transition-colors text-sm text-base-content"
    >
      <Icon className="w-4 h-4 text-primary" />
      {label}
    </button>
  );
}
