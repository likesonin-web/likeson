'use client';
import { useState, useRef, useCallback, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Send, Paperclip, Smile, Mic, Image as ImageIcon,
  FileText, X, StopCircle, Loader2,
} from 'lucide-react';
import { useChat, useConversationUploadProgress } from '@/hooks/useChat';
import { EmojiPicker } from './ChatWidgets';
import { useDispatch } from 'react-redux';
import { socketNewMessage } from '@/store/slices/chatSlice';

export default function MessageInput({ conversation, replyTo, onCancelReply, currentUser }) {
  const dispatch = useDispatch();
  const { sendMessage, sendMedia, sendTyping } = useChat();
  const progress = useConversationUploadProgress(conversation._id);

  const [text, setText]             = useState('');
  const [emojiOpen, setEmojiOpen]   = useState(false);
  const [attachOpen, setAttachOpen] = useState(false);
  const [recording, setRecording]   = useState(false);
  const [recDuration, setRecDuration] = useState(0);
  const [sending, setSending]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [emojiPos, setEmojiPos]     = useState({ bottom: 0, left: 0 });

  const inputRef       = useRef(null);
  const fileRef        = useRef(null);
  const emojiWrapRef   = useRef(null);
  const typingTimer    = useRef(null);
  const mediaRecorder  = useRef(null);
  const audioChunks    = useRef([]);
  const recTimer       = useRef(null);
  const streamRef      = useRef(null);

  // Auto-focus on convo change
  useEffect(() => {
    inputRef.current?.focus();
    setText('');
    setEmojiOpen(false);
  }, [conversation._id]);

  // Close emoji on outside click
  useEffect(() => {
    if (!emojiOpen) return;
    const handler = (e) => {
      if (emojiWrapRef.current && !emojiWrapRef.current.contains(e.target)) {
        setEmojiOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [emojiOpen]);

  const handleTyping = useCallback((val) => {
    setText(val);
    sendTyping(conversation._id, true);
    clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => sendTyping(conversation._id, false), 2500);
  }, [sendTyping, conversation._id]);

  const handleSend = useCallback(async () => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setText('');
    // Reset textarea height
    if (inputRef.current) {
      inputRef.current.style.height = 'auto';
    }
    setEmojiOpen(false);
    sendTyping(conversation._id, false);
    try {
      await sendMessage(conversation._id, {
        type: 'text',
        text: trimmed,
        replyTo: replyTo?._id,
      });
      onCancelReply?.();
    } catch (err) {
      console.error('Send failed', err);
      setText(trimmed); // restore on fail
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  }, [text, sending, conversation._id, replyTo, sendMessage, sendTyping, onCancelReply]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // BUG3 FIX: Optimistic media message — show placeholder immediately, replace on server response
  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAttachOpen(false);
    e.target.value = '';

    // Build optimistic message
    const localUrl = URL.createObjectURL(file);
    const mimeType = file.type;
    let msgType = 'file';
    if (mimeType.startsWith('image/')) msgType = 'image';
    if (mimeType.startsWith('video/')) msgType = 'video';
    if (mimeType.startsWith('audio/')) msgType = 'audio';

    const optimisticMsg = {
      _id:          `optimistic_${Date.now()}`,
      conversation:  conversation._id,
      sender: {
        _id:    currentUser?._id,
        name:   currentUser?.name,
        avatar: currentUser?.avatar,
      },
      type:      msgType,
      media: {
        url:      localUrl,
        fileName: file.name,
        size:     file.size,
        mimeType,
      },
      createdAt:  new Date().toISOString(),
      _optimistic: true,
    };

    // Inject into store immediately
    dispatch(socketNewMessage({ conversationId: conversation._id, message: optimisticMsg }));

    setUploading(true);
    try {
      await sendMedia(conversation._id, file);
      // Server response will upsert via socket/thunk and replace optimistic entry
    } catch (err) {
      console.error('Upload failed', err);
    } finally {
      setUploading(false);
      URL.revokeObjectURL(localUrl);
    }
  };

  const handleEmojiSelect = (emoji) => {
    setText((prev) => prev + emoji);
    setEmojiOpen(false);
    inputRef.current?.focus();
  };

  const openEmoji = () => {
    setAttachOpen(false);
    setEmojiOpen((v) => !v);
  };

  // BUG2 FIX: Use proper audio constraints + prefer opus codec + timeslice for reliable chunks
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 44100,
        },
      });
      streamRef.current = stream;

      // Pick best supported mime type
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/ogg;codecs=opus',
        'audio/mp4',
      ];
      const mimeType = mimeTypes.find((t) => MediaRecorder.isTypeSupported(t)) || '';

      mediaRecorder.current = new MediaRecorder(stream, mimeType ? { mimeType } : {});
      audioChunks.current   = [];

      // timeslice=250ms ensures data is collected frequently, not just on stop
      mediaRecorder.current.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunks.current.push(e.data);
      };

      mediaRecorder.current.onstop = async () => {
        const actualType = mediaRecorder.current.mimeType || 'audio/webm';
        const ext = actualType.includes('ogg') ? 'ogg' : actualType.includes('mp4') ? 'mp4' : 'webm';
        const blob = new Blob(audioChunks.current, { type: actualType });

        if (blob.size < 100) return; // too small, ignore

        const duration = recDuration;
        const file = new File([blob], `voice-${Date.now()}.${ext}`, { type: actualType });

        // Optimistic voice message
        const localUrl = URL.createObjectURL(blob);
        const optimisticMsg = {
          _id:         `optimistic_voice_${Date.now()}`,
          conversation: conversation._id,
          sender: {
            _id:    currentUser?._id,
            name:   currentUser?.name,
            avatar: currentUser?.avatar,
          },
          type:  'audio',
          media: { url: localUrl, duration, mimeType: actualType },
          createdAt: new Date().toISOString(),
          _optimistic: true,
        };
        dispatch(socketNewMessage({ conversationId: conversation._id, message: optimisticMsg }));

        try {
          await sendMedia(conversation._id, file, duration);
        } catch (err) {
          console.error('Voice send failed', err);
        } finally {
          URL.revokeObjectURL(localUrl);
        }

        // Stop all mic tracks
        stream.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      };

      mediaRecorder.current.start(250); // collect every 250ms
      setRecording(true);
      setRecDuration(0);

      recTimer.current = setInterval(() => {
        setRecDuration((d) => d + 1);
      }, 1000);

    } catch (err) {
      console.error('Mic access denied:', err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      mediaRecorder.current.stop();
    }
    clearInterval(recTimer.current);
    setRecording(false);
    setRecDuration(0);
  };

  const cancelRecording = () => {
    if (mediaRecorder.current?.state === 'recording') {
      // Remove onstop so data is discarded
      mediaRecorder.current.onstop = null;
      mediaRecorder.current.stop();
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    audioChunks.current = [];
    clearInterval(recTimer.current);
    setRecording(false);
    setRecDuration(0);
  };

  const formatRecTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const canSend = text.trim().length > 0 && !recording;

  return (
    <div className="msg-input-container" ref={emojiWrapRef}>
      {/* Upload progress bar */}
      <AnimatePresence>
        {(uploading || (progress > 0 && progress < 100)) && (
          <motion.div
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: uploading ? 0.85 : progress / 100 }}
            exit={{ opacity: 0 }}
            style={{ transformOrigin: 'left' }}
            className="msg-upload-bar"
          />
        )}
      </AnimatePresence>

      {/* Reply preview */}
      <AnimatePresence>
        {replyTo && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="msg-reply-bar-wrap"
          >
            <div className="msg-reply-accent" />
            <div className="msg-reply-preview-inner">
              <span className="msg-reply-to-name">
                Replying to {replyTo.sender?.name || 'message'}
              </span>
              <p className="msg-reply-to-text">
                {replyTo.type === 'text' ? replyTo.text?.slice(0, 60) : `[${replyTo.type}]`}
              </p>
            </div>
            <button onClick={onCancelReply} className="msg-reply-close">
              <X size={15} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recording UI */}
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="msg-recording-bar"
          >
            <span className="msg-recording-dot" />
            <span className="msg-recording-label">Recording voice message</span>
            <span className="msg-recording-time">{formatRecTime(recDuration)}</span>
            <button onClick={cancelRecording} className="msg-recording-cancel">
              <X size={14} /> Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* BUG4 FIX: Emoji picker state-driven, positioned above input */}
      <AnimatePresence>
        {emojiOpen && (
          <div className="msg-input-emoji-picker-abs">
            <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setEmojiOpen(false)} />
          </div>
        )}
      </AnimatePresence>

      {/* Input row */}
      <div className="msg-input-row">
        {/* Emoji btn */}
        <button
          onClick={openEmoji}
          className={`msg-input-icon-btn ${emojiOpen ? 'msg-input-icon-btn-active' : ''}`}
          disabled={recording}
          title="Emoji"
        >
          <Smile size={20} />
        </button>

        {/* Textarea */}
        <div className="msg-input-textarea-wrap">
          <textarea
            ref={inputRef}
            rows={1}
            value={text}
            onChange={(e) => {
              handleTyping(e.target.value);
              e.target.style.height = 'auto';
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px';
            }}
            onKeyDown={handleKey}
            placeholder={recording ? 'Recording…' : 'Type a message…'}
            className="msg-input-textarea"
            disabled={recording}
          />
        </div>

        {/* Right side */}
        <div className="msg-input-right">
          {/* Attach */}
          {!recording && (
            <div className="msg-attach-wrap">
              <button
                onClick={() => { setAttachOpen((v) => !v); setEmojiOpen(false); }}
                className={`msg-input-icon-btn ${attachOpen ? 'msg-input-icon-btn-active' : ''}`}
                title="Attach file"
              >
                {uploading ? <Loader2 size={20} className="animate-spin" /> : <Paperclip size={20} />}
              </button>
              <AnimatePresence>
                {attachOpen && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 8 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.9, y: 8 }}
                    className="msg-attach-menu"
                  >
                    <button
                      className="msg-attach-item"
                      onClick={() => {
                        fileRef.current.accept = 'image/*,video/*';
                        fileRef.current.click();
                        setAttachOpen(false);
                      }}
                    >
                      <ImageIcon size={16} /> Photo / Video
                    </button>
                    <button
                      className="msg-attach-item"
                      onClick={() => {
                        fileRef.current.accept = '.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip';
                        fileRef.current.click();
                        setAttachOpen(false);
                      }}
                    >
                      <FileText size={16} /> Document
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
              <input ref={fileRef} type="file" className="hidden" onChange={handleFileSelect} />
            </div>
          )}

          {/* Send / Mic */}
          <AnimatePresence mode="wait">
            {canSend ? (
              <motion.button
                key="send"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={handleSend}
                disabled={sending}
                className="msg-send-btn"
              >
                {sending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
              </motion.button>
            ) : recording ? (
              <motion.button
                key="stop"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                onClick={stopRecording}
                className="msg-send-btn"
                title="Send voice message"
              >
                <Send size={18} />
              </motion.button>
            ) : (
              <motion.button
                key="mic"
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.7, opacity: 0 }}
                transition={{ duration: 0.12 }}
                onClick={startRecording}
                className="msg-mic-btn"
                title="Hold to record voice message"
              >
                <Mic size={18} />
              </motion.button>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}