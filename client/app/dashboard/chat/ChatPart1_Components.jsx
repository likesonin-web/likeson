'use client';

import React, {
  useState, useEffect, useRef, useCallback, useMemo, memo,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Play, Pause, Download, X, Check, CheckCheck,
  Image as ImageIcon, File, Camera, Video as VideoFileIcon,
  Smile, ZoomIn, Sticker, Search, Loader2,
  AlertCircle,
} from 'lucide-react';
import { Grid } from '@giphy/react-components';
import { GiphyFetch } from '@giphy/js-fetch-api';
import { useSelector } from 'react-redux';
import { selectUserPresence, selectTypingUsers } from '@/store/slices/chatSlice';

// ─── GIPHY CLIENT ─────────────────────────────────────────────────────────────
export const gf = new GiphyFetch(process.env.NEXT_PUBLIC_GIPHY_API_KEY || '');

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
export const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🙏', '🔥'];

export const SAMPLE_AVATARS = [
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix&backgroundColor=b6e3f4',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Aneka&backgroundColor=c0aede',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Milo&backgroundColor=d1d4f9',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Zara&backgroundColor=ffd5dc',
  'https://api.dicebear.com/7.x/avataaars/svg?seed=Oscar&backgroundColor=ffdfbf',
];

export const STICKER_CATEGORIES = [
  { id: 'trending',  label: 'Trending',  icon: '🔥', tag: null        },
  { id: 'reactions', label: 'Reactions', icon: '😂', tag: 'reaction'  },
  { id: 'greetings', label: 'Greetings', icon: '👋', tag: 'hello'     },
  { id: 'love',      label: 'Love',      icon: '❤️', tag: 'love'      },
  { id: 'funny',     label: 'Funny',     icon: '😜', tag: 'funny'     },
  { id: 'celebrate', label: 'Celebrate', icon: '🎉', tag: 'celebrate' },
  { id: 'thanks',    label: 'Thanks',    icon: '🙏', tag: 'thank you' },
  { id: 'sorry',     label: 'Sorry',     icon: '🥺', tag: 'sorry'     },
  { id: 'animals',   label: 'Animals',   icon: '🐶', tag: 'animals'   },
  { id: 'work',      label: 'Work',      icon: '💼', tag: 'work'      },
];

export const EMOJI_CATEGORIES = [
  { id: 'quick',    label: 'Quick',    icon: '⚡', emojis: ['👍','❤️','😂','😮','😢','😡','🙏','🔥','🎉','✅','💯','🤔'] },
  { id: 'smileys',  label: 'Smileys',  icon: '😀', emojis: ['😀','😃','😄','😁','😆','😅','🤣','😂','🙂','🙃','😉','😊','😇','🥰','😍','🤩','😘','😗','😚','😙','🥲','😋','😛','😜','🤪','😝','🤑','🤗','🤭','🤫','🤔','😐','😑','😶','😏','😒','🙄','😬','🤥','😌','😔','😪','🤤','😴','😷','🤒','🤕','🤢'] },
  { id: 'gestures', label: 'Gestures', icon: '👋', emojis: ['👋','🤚','🖐️','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💪'] },
  { id: 'hearts',   label: 'Hearts',   icon: '❤️', emojis: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','🤎','❤️‍🔥','❤️‍🩹','💔','❣️','💕','💞','💓','💗','💖','💘','💝','💟','♥️','💌','💋'] },
  { id: 'symbols',  label: 'Symbols',  icon: '💯', emojis: ['💯','✅','❌','⭕','🔴','🟠','🟡','🟢','🔵','🟣','⚫','⚪','‼️','⁉️','❓','❔','❕','❗','🔔','🎵','🎶','💤','♻️','🔞','📵','🚫','⛔','🆘','🆒','🆕','🆓','🆙','🆗','🔝','🔥'] },
];

// ─── UTILITIES ────────────────────────────────────────────────────────────────
export const formatTime = (date) => {
  if (!date) return '';
  return new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
};

export const formatDate = (date) => {
  if (!date) return '';
  const d          = new Date(date);
  const now        = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart.getTime() - 86400000);
  const msgStart   = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (msgStart.getTime() === todayStart.getTime()) return 'Today';
  if (msgStart.getTime() === yestStart.getTime())  return 'Yesterday';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 B';
  if (bytes < 1024)    return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
};

export const formatSeconds = (s) => {
  if (!s || isNaN(s)) return '0:00';
  const m   = Math.floor(s / 60);
  const sec = Math.floor(s % 60);
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

export const getUserAvatar = (user, index = 0) => {
  if (user?.avatar) return user.avatar;
  return SAMPLE_AVATARS[index % SAMPLE_AVATARS.length];
};

export const getRoleLabel = (role) => {
  const map = {
    admin: 'Admin', superadmin: 'Super Admin', owner: 'Owner',
    member: 'Member', moderator: 'Moderator', guest: 'Guest',
    user: 'User', manager: 'Manager', hr: 'HR', finance: 'Finance',
    support: 'Support', developer: 'Developer', designer: 'Designer',
    marketing: 'Marketing', sales: 'Sales',
    doctor: 'Doctor', driver: 'Driver', pharmacy: 'Pharmacy',
    'care assistant': 'Care Assistant', transportpartner: 'Transport Partner',
    'lab partner': 'Lab Partner', customer: 'Customer',
  };
  if (!role) return 'Member';
  return map[role?.toLowerCase()] || role;
};

export const isConvAdmin = (participant) =>
  ['owner', 'admin'].includes(participant?.conversationRole?.toLowerCase());

// ─── AUDIO PLAYER ─────────────────────────────────────────────────────────────
export const AudioPlayer = memo(({ url }) => {
  const audioRef    = useRef(null);
  const [playing,  setPlaying]  = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [current,  setCurrent]  = useState(0);

  const togglePlay = useCallback(() => {
    const a = audioRef.current;
    if (!a) return;
    if (playing) { a.pause(); setPlaying(false); }
    else { a.play().catch(() => {}); setPlaying(true); }
  }, [playing]);

  return (
    <div className="flex items-center gap-2.5 min-w-[200px] max-w-[260px]">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (!a) return;
          setCurrent(a.currentTime);
          setProgress(a.duration ? (a.currentTime / a.duration) * 100 : 0);
        }}
        onEnded={() => {
          setPlaying(false); setProgress(0); setCurrent(0);
          if (audioRef.current) audioRef.current.currentTime = 0;
        }}
        onLoadedMetadata={() => { if (audioRef.current) setDuration(audioRef.current.duration); }}
        preload="metadata"
      />
      <motion.button
        whileTap={{ scale: 0.9 }} onClick={togglePlay}
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'rgba(255,255,255,0.25)' }}
        aria-label={playing ? 'Pause' : 'Play'}
      >
        {playing ? <Pause size={14} /> : <Play size={14} />}
      </motion.button>
      <div className="flex-1 flex flex-col gap-1">
        <div
          className="relative h-1.5 rounded-full cursor-pointer"
          style={{ background: 'rgba(255,255,255,0.3)' }}
          onClick={(e) => {
            const a = audioRef.current;
            if (!a || !a.duration) return;
            const rect = e.currentTarget.getBoundingClientRect();
            a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
          }}
          role="slider"
          aria-label="Audio progress"
        >
          <div
            className="absolute inset-y-0 left-0 bg-white rounded-full transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
        <div className="flex justify-between">
          <span className="text-[10px] opacity-70">{formatSeconds(current)}</span>
          <span className="text-[10px] opacity-70">{formatSeconds(duration)}</span>
        </div>
      </div>
    </div>
  );
});
AudioPlayer.displayName = 'AudioPlayer';

// ─── VIDEO PLAYER ─────────────────────────────────────────────────────────────
export const VideoPlayer = memo(({ url, thumbnailUrl }) => {
  const [expanded, setExpanded] = useState(false);
  return (
    <>
      <div
        className="relative rounded-2xl overflow-hidden max-w-[260px] cursor-pointer group"
        onClick={() => setExpanded(true)}
        role="button"
        aria-label="Play video"
      >
        <video
          src={url}
          className="w-full max-h-48 object-cover block"
          poster={thumbnailUrl || undefined}
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <motion.div
            whileHover={{ scale: 1.1 }}
            className="w-12 h-12 rounded-full bg-white/90 flex items-center justify-center shadow-xl"
          >
            <Play size={16} className="text-gray-800 ml-0.5" />
          </motion.div>
        </div>
      </div>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.95)' }}
            onClick={() => setExpanded(false)}
          >
            <button
              className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
              onClick={() => setExpanded(false)}
              aria-label="Close video"
            >
              <X size={24} />
            </button>
            <video
              src={url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
VideoPlayer.displayName = 'VideoPlayer';

// ─── IMAGE MESSAGE ─────────────────────────────────────────────────────────────
export const ImageMessage = memo(({ url, caption }) => {
  const [lightbox, setLightbox] = useState(false);
  return (
    <>
      <div
        className="cursor-pointer group relative"
        onClick={() => setLightbox(true)}
        role="button"
        aria-label="View image"
      >
        <img
          src={url}
          alt={caption || 'Image'}
          className="max-w-[240px] rounded-xl object-cover block transition-opacity group-hover:opacity-90"
          loading="lazy"
        />
        <div className="absolute inset-0 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center bg-black/10">
          <ZoomIn size={20} className="text-white drop-shadow" />
        </div>
        {caption && <p className="text-sm mt-1 break-words">{caption}</p>}
      </div>
      <AnimatePresence>
        {lightbox && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
            style={{ background: 'rgba(0,0,0,0.97)' }}
            onClick={() => setLightbox(false)}
          >
            <button
              className="absolute top-4 right-4 text-white"
              onClick={() => setLightbox(false)}
              aria-label="Close lightbox"
            >
              <X size={24} />
            </button>
            <img
              src={url}
              alt="Full size"
              className="max-w-full max-h-full object-contain rounded-xl"
              onClick={(e) => e.stopPropagation()}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
ImageMessage.displayName = 'ImageMessage';

// ─── STICKER MESSAGE ──────────────────────────────────────────────────────────
export const StickerMessage = memo(({ message }) => {
  const src =
    message?.sticker?.giphyUrl ||
    message?.attachments?.[0]?.url ||
    (message?.content && (message.content.startsWith('http') || message.content.endsWith('.gif'))
      ? message.content
      : null);

  if (src) {
    return (
      <img
        src={src}
        alt={message?.sticker?.title || 'Sticker'}
        className="max-w-[160px] max-h-[160px] object-contain select-none"
        draggable={false}
      />
    );
  }
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm"
      style={{
        background: 'rgba(254,243,199,0.9)',
        color: '#92400e',
        border: '1px solid rgba(252,211,77,0.4)',
      }}
    >
      🎭 {message?.content || 'Sticker'}
    </div>
  );
});
StickerMessage.displayName = 'StickerMessage';

// ─── FILE ATTACHMENT ──────────────────────────────────────────────────────────
export const FileAttachment = memo(({ attachment }) => (
  <a
    href={attachment.url}
    target="_blank"
    rel="noopener noreferrer"
    download={attachment.originalName}
    className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-colors max-w-[240px] group"
    style={{ background: 'rgba(255,255,255,0.15)' }}
  >
    <div
      className="shrink-0 w-9 h-9 rounded-lg flex items-center justify-center"
      style={{ background: 'rgba(255,255,255,0.2)' }}
    >
      <File size={16} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium truncate">{attachment.originalName || 'File'}</p>
      <p className="text-[11px] opacity-60">{formatFileSize(attachment.size)}</p>
    </div>
    <Download size={14} className="shrink-0 opacity-60 group-hover:opacity-100 transition-opacity" />
  </a>
));
FileAttachment.displayName = 'FileAttachment';

// ─── READ RECEIPT ─────────────────────────────────────────────────────────────
// deliveredAt is ALWAYS null in the API response.
// Use receipts.length > 0 to detect "delivered" state instead.
//   • Single grey tick  = Sent       (message sent, no receipts yet)
//   • Double grey tick  = Delivered  (receiver has a receipt entry but hasn't read)
//   • Double blue tick  = Read       (readAt is set on any receipt)
export const ReadReceipt = memo(({ message, isMine }) => {
  if (!isMine) return null;

  const receipts     = message.receipts || [];
  const readByAnyone = receipts.some((r) => r.readAt);
  // deliveredAt is always null — treat any receipt entry as "delivered"
  const delivered    = receipts.length > 0;

  if (readByAnyone) {
    return <CheckCheck size={13} style={{ color: 'rgba(56,189,248,1)' }} aria-label="Read" />;
  }
  if (delivered) {
    return <CheckCheck size={13} style={{ color: 'rgba(255,255,255,0.55)' }} aria-label="Delivered" />;
  }
  return <Check size={12} style={{ color: 'rgba(255,255,255,0.55)' }} aria-label="Sent" />;
});
ReadReceipt.displayName = 'ReadReceipt';

// ─── EMOJI PICKER ─────────────────────────────────────────────────────────────
export const EmojiPicker = memo(({ onSelect, onClose }) => {
  const [activeCategory,  setActiveCategory]  = useState('quick');
  const [stickerMode,     setStickerMode]      = useState(false);
  const [stickerCategory, setStickerCategory]  = useState('trending');
  const [stickerSearch,   setStickerSearch]    = useState('');
  const pickerRef = useRef(null);

  const currentCategory = EMOJI_CATEGORIES.find((c) => c.id === activeCategory);

  const fetchGifs = useCallback((offset) => {
    if (stickerSearch.trim()) {
      return gf.search(stickerSearch, { type: 'stickers', offset, limit: 12, rating: 'g' });
    }
    const cat = STICKER_CATEGORIES.find((c) => c.id === stickerCategory);
    if (!cat || cat.tag === null) {
      return gf.trending({ type: 'stickers', offset, limit: 12, rating: 'g' });
    }
    return gf.search(cat.tag, { type: 'stickers', offset, limit: 12, rating: 'g' });
  }, [stickerCategory, stickerSearch]);

  return (
    <motion.div
      ref={pickerRef}
      initial={{ opacity: 0, y: 10, scale: 0.95 }}
      animate={{ opacity: 1, y: 0,  scale: 1    }}
      exit={{    opacity: 0, y: 10, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      className="absolute bottom-full left-0 mb-2 z-40 rounded-2xl overflow-hidden shadow-2xl"
      style={{
        width: 340,
        background: 'var(--base-100)',
        border: '1px solid var(--base-300)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.15)',
      }}
      role="dialog"
      aria-label="Emoji & Sticker picker"
    >
      <div className="flex border-b" style={{ borderColor: 'var(--base-300)' }}>
        <button
          onClick={() => setStickerMode(false)}
          className="flex-1 py-2.5 text-xs font-semibold transition-colors"
          style={{
            color: !stickerMode ? 'var(--primary)' : 'var(--base-content)',
            borderBottom: !stickerMode ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          😀 Emoji
        </button>
        <button
          onClick={() => setStickerMode(true)}
          className="flex-1 py-2.5 text-xs font-semibold transition-colors"
          style={{
            color: stickerMode ? 'var(--primary)' : 'var(--base-content)',
            borderBottom: stickerMode ? '2px solid var(--primary)' : '2px solid transparent',
          }}
        >
          🎭 Stickers
        </button>
      </div>

      {!stickerMode ? (
        <>
          <div className="flex gap-0.5 px-2 pt-2 pb-1 overflow-x-auto scrollbar-none">
            {EMOJI_CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className="shrink-0 px-2 py-1 rounded-lg text-xs transition-colors"
                style={{
                  background: activeCategory === cat.id ? 'var(--primary)' : 'transparent',
                  color:      activeCategory === cat.id ? 'var(--primary-content)' : 'var(--base-content)',
                }}
                aria-pressed={activeCategory === cat.id}
                title={cat.label}
              >
                {cat.icon}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-8 gap-0.5 p-2 max-h-[200px] overflow-y-auto">
            {currentCategory?.emojis.map((emoji, i) => (
              <motion.button
                key={`${emoji}-${i}`}
                whileHover={{ scale: 1.2 }}
                whileTap={{ scale: 0.9 }}
                onClick={() => { onSelect(emoji); }}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-lg hover:bg-base-200 transition-colors"
                aria-label={emoji}
              >
                {emoji}
              </motion.button>
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="px-3 py-2">
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ background: 'var(--base-200)' }}>
              <Search size={13} style={{ color: 'var(--base-content)', opacity: 0.5 }} />
              <input
                value={stickerSearch}
                onChange={(e) => setStickerSearch(e.target.value)}
                placeholder="Search stickers…"
                className="flex-1 bg-transparent text-xs outline-none"
                style={{ color: 'var(--base-content)' }}
                aria-label="Search stickers"
              />
            </div>
          </div>
          {!stickerSearch && (
            <div className="flex gap-1 px-3 pb-2 overflow-x-auto scrollbar-none">
              {STICKER_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setStickerCategory(cat.id)}
                  className="shrink-0 px-2.5 py-1 rounded-full text-[10px] font-medium transition-colors"
                  style={{
                    background: stickerCategory === cat.id ? 'var(--primary)' : 'var(--base-200)',
                    color:      stickerCategory === cat.id ? 'var(--primary-content)' : 'var(--base-content)',
                  }}
                >
                  {cat.icon} {cat.label}
                </button>
              ))}
            </div>
          )}
          <div className="px-2 pb-2 overflow-y-auto" style={{ maxHeight: 220 }}>
            {process.env.NEXT_PUBLIC_GIPHY_API_KEY ? (
              <Grid
                key={`${stickerCategory}-${stickerSearch}`}
                fetchGifs={fetchGifs}
                width={316}
                columns={3}
                gutter={4}
                onGifClick={(gif, e) => {
                  e.preventDefault();
                  const url        = gif.images?.fixed_height?.webp || gif.images?.fixed_height?.url || gif.images?.original?.url || '';
                  const previewUrl = gif.images?.fixed_height_small?.webp || url;
                  onSelect({
                    type: 'sticker',
                    sticker: {
                      giphyId:  gif.id,
                      giphyUrl: url,
                      previewUrl,
                      title:    gif.title || 'sticker',
                      width:    gif.images?.original?.width  || null,
                      height:   gif.images?.original?.height || null,
                      rating:   gif.rating || 'g',
                    },
                    content: gif.title || 'sticker',
                  });
                }}
                noResultsMessage={
                  <p className="text-center text-xs py-4 opacity-50">No stickers found</p>
                }
              />
            ) : (
              <div className="flex flex-col items-center justify-center py-8 opacity-50">
                <Sticker size={32} className="mb-2" />
                <p className="text-xs">Add NEXT_PUBLIC_GIPHY_API_KEY</p>
              </div>
            )}
          </div>
        </>
      )}
    </motion.div>
  );
});
EmojiPicker.displayName = 'EmojiPicker';

// ─── UPLOAD PREVIEW MODAL ─────────────────────────────────────────────────────
// FIX 1: previewUrl is now managed via useState + useEffect instead of useMemo
//         so it updates reliably when `files` prop changes and revokes properly.
// FIX 2: Added localSending boolean state to prevent double-send during the gap
//         between click and when XHR progress events first fire (progress===0 window).
//         isSending = localSending || (progress > 0 && progress < 100)
// FIX 3: Image preview uses an onError handler to catch broken blob URLs and
//         falls back to a placeholder UI.
// FIX 4: autoFocus removed from caption input to prevent cursor artifact (">")
//         rendering in the input box on some browsers before the modal fully mounts.
export const UploadPreviewModal = memo(({ files, onSend, onCancel, progress }) => {
  const [caption,      setCaption]      = useState('');
  const [previewUrl,   setPreviewUrl]   = useState(null);
  const [imgError,     setImgError]     = useState(false);
  // FIX: localSending prevents re-enabling the Send button before XHR fires
  const [localSending, setLocalSending] = useState(false);

  const file    = files?.[0];
  const isImage = file?.type?.startsWith('image/');
  const isVideo = file?.type?.startsWith('video/');
  const isAudio = file?.type?.startsWith('audio/');

  // FIX: Generate object URL imperatively so it's always in sync with the file
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      setImgError(false);
      return;
    }
    // Reset error state whenever file changes
    setImgError(false);
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    // Cleanup on unmount or file change
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  // FIX: isSending is true as soon as button is clicked, not just when XHR fires
  const isSending = localSending || (progress > 0 && progress < 100);

  // Reset localSending when upload completes or fails (progress reaches 100 or resets to 0)
  useEffect(() => {
    if (progress === 100 || progress === 0) {
      setLocalSending(false);
    }
  }, [progress]);

  const handleSend = useCallback(() => {
    if (isSending) return;
    // FIX: Set localSending true immediately on click — before XHR starts
    setLocalSending(true);
    onSend(caption);
  }, [isSending, caption, onSend]);

  // Allow Enter key in caption to trigger send
  const handleCaptionKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !isSending) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend, isSending]);

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
      role="dialog"
      aria-modal="true"
      aria-label="Send file"
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{ background: 'var(--base-100)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--base-300)' }}>
          <h3 className="font-semibold text-sm" style={{ color: 'var(--base-content)' }}>
            Send {files.length > 1 ? `${files.length} Files` : 'File'}
          </h3>
          <button
            onClick={onCancel}
            disabled={isSending}
            className="transition-opacity disabled:opacity-40"
            style={{ color: 'var(--base-content)', opacity: 0.5 }}
            aria-label="Cancel"
          >
            <X size={18} />
          </button>
        </div>

        {/* Preview area */}
        <div className="p-4">
          <div
            className="rounded-2xl overflow-hidden border flex items-center justify-center min-h-[180px] mb-3"
            style={{ background: 'var(--base-200)', borderColor: 'var(--base-300)' }}
          >
            {/* IMAGE PREVIEW — FIX: use state-managed previewUrl, show fallback on error */}
            {isImage && previewUrl && !imgError && (
              <img
                src={previewUrl}
                alt="Preview"
                className="max-h-52 max-w-full object-contain"
                onError={() => setImgError(true)}
              />
            )}

            {/* FIX: Fallback when blob URL fails or image errors */}
            {isImage && (!previewUrl || imgError) && (
              <div className="text-center p-6">
                <ImageIcon size={48} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--base-content)' }} />
                <p className="text-sm font-medium truncate max-w-[200px]" style={{ color: 'var(--base-content)' }}>
                  {file?.name}
                </p>
                <p className="text-xs mt-1 opacity-50" style={{ color: 'var(--base-content)' }}>
                  {formatFileSize(file?.size)}
                </p>
              </div>
            )}

            {isVideo && previewUrl && (
              <video src={previewUrl} controls className="max-h-52 w-full" />
            )}

            {isAudio && previewUrl && (
              <div className="w-full p-4 text-center">
                <div className="text-5xl mb-3">🎵</div>
                <audio src={previewUrl} controls className="w-full" />
              </div>
            )}

            {!isImage && !isVideo && !isAudio && (
              <div className="text-center p-6">
                <File size={48} className="mx-auto mb-3 opacity-30" style={{ color: 'var(--base-content)' }} />
                <p className="text-sm font-medium truncate max-w-[200px]" style={{ color: 'var(--base-content)' }}>
                  {file?.name}
                </p>
                <p className="text-xs mt-1 opacity-50" style={{ color: 'var(--base-content)' }}>
                  {formatFileSize(file?.size)}
                </p>
                {files.length > 1 && (
                  <p className="text-xs mt-1 opacity-60" style={{ color: 'var(--primary)' }}>
                    +{files.length - 1} more files
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Caption input — FIX: removed autoFocus to prevent cursor ">" rendering bug */}
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            onKeyDown={handleCaptionKeyDown}
            placeholder="Add a caption… (optional)"
            disabled={isSending}
            className="w-full rounded-2xl px-4 py-3 text-sm outline-none transition-all"
            style={{
              background: 'var(--base-200)',
              color: 'var(--base-content)',
              border: '1px solid var(--base-300)',
            }}
            aria-label="Caption"
          />

          {/* FIX: Show indeterminate shimmer while localSending=true but progress===0 */}
          {localSending && progress === 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1 opacity-60" style={{ color: 'var(--base-content)' }}>
                <span>Preparing upload…</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--base-300)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--primary)', width: '30%' }}
                  animate={{ x: ['0%', '200%', '0%'] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                />
              </div>
            </div>
          )}

          {progress > 0 && progress < 100 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs mb-1 opacity-60" style={{ color: 'var(--base-content)' }}>
                <span>Uploading…</span><span>{progress}%</span>
              </div>
              <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--base-300)' }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: 'var(--primary)', width: `${progress}%` }}
                  transition={{ duration: 0.3 }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 px-4 pb-5">
          <button
            onClick={onCancel}
            disabled={isSending}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold transition-colors disabled:opacity-40"
            style={{ border: '1px solid var(--base-300)', color: 'var(--base-content)' }}
          >
            Cancel
          </button>

          {/* FIX: Send button shows spinner + "Sending…" text while uploading */}
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={handleSend}
            disabled={isSending}
            className="flex-1 py-3 rounded-2xl text-sm font-semibold disabled:opacity-70 transition-colors flex items-center justify-center gap-2"
            style={{ background: 'var(--primary)', color: 'var(--primary-content)' }}
            aria-label={isSending ? 'Sending file' : 'Send file'}
          >
            {isSending ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Sending…</span>
              </>
            ) : (
              <span>{`Send${files.length > 1 ? ` (${files.length})` : ''}`}</span>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
});
UploadPreviewModal.displayName = 'UploadPreviewModal';

// ─── ATTACH MENU ──────────────────────────────────────────────────────────────
// FIX 1: Removed onClick={onClose} from <label> — closing the parent before the
//         OS file picker returns silently loses the selected files.
// FIX 2: onClose() is now called ONLY inside onChange after files are confirmed.
// FIX 3: Reset input value after selection so same file can be re-picked.
export const AttachMenu = memo(({ onFileSelect, onClose }) => {
  const options = [
    { icon: <ImageIcon size={18} />,     label: 'Photo',    accept: 'image/*',                              color: 'var(--error)'     },
    { icon: <VideoFileIcon size={18} />, label: 'Video',    accept: 'video/*',                              color: 'var(--secondary)' },
    { icon: <File size={18} />,          label: 'Document', accept: '.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv', color: 'var(--primary)'   },
    { icon: <Camera size={18} />,        label: 'Camera',   accept: 'image/*', capture: true,               color: 'var(--success)'   },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1    }}
      exit={{    opacity: 0, y: 8, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="absolute bottom-full left-0 mb-2 z-30 rounded-2xl overflow-hidden shadow-2xl min-w-[160px]"
      style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)' }}
      role="menu"
    >
      {options.map(({ icon, label, accept, color, capture }) => (
        // FIX: No onClick on label — do NOT close the menu until files are confirmed
        <label
          key={label}
          className="flex items-center gap-3 px-4 py-3 cursor-pointer transition-colors hover:bg-base-200"
          role="menuitem"
        >
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: `color-mix(in srgb, ${color} 12%, transparent)`, color }}
          >
            {icon}
          </span>
          <span className="text-sm font-medium" style={{ color: 'var(--base-content)' }}>{label}</span>
          <input
            type="file"
            accept={accept}
            capture={capture ? 'environment' : undefined}
            className="hidden"
            multiple={label === 'Photo' || label === 'Document'}
            onChange={(e) => {
              // FIX: Only close menu and call onFileSelect after files are confirmed
              if (e.target.files?.length) {
                onFileSelect(e.target.files);
                e.target.value = ''; // reset so same file can be re-selected
                onClose();           // close AFTER files are captured
              }
            }}
          />
        </label>
      ))}
    </motion.div>
  );
});
AttachMenu.displayName = 'AttachMenu';

// ─── PRESENCE DOT ─────────────────────────────────────────────────────────────
export const PresenceDot = memo(({ userId }) => {
  const presence = useSelector(selectUserPresence(userId || ''));
  if (!userId) return null;
  return (
    <span
      className="absolute bottom-0 right-0 w-3 h-3 rounded-full border-2"
      style={{
        background:  presence?.isOnline ? 'var(--success)' : 'var(--base-300)',
        borderColor: 'var(--base-100)',
      }}
      aria-label={presence?.isOnline ? 'Online' : 'Offline'}
    />
  );
});
PresenceDot.displayName = 'PresenceDot';

// ─── TYPING INDICATOR ─────────────────────────────────────────────────────────
export const TypingIndicator = memo(({ conversationId }) => {
  const typingUsers = useSelector(selectTypingUsers(conversationId));
  if (!typingUsers || typingUsers.length === 0) return null;
  const names = typingUsers.map((u) => u.name).join(', ');
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 4 }}
      className="flex items-center gap-2 px-4 pb-1 text-xs"
      style={{ color: 'var(--base-content)', opacity: 0.6 }}
      aria-live="polite"
      aria-label={`${names} is typing`}
    >
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: 'var(--primary)' }}
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.15 }}
          />
        ))}
      </span>
      <span>
        <span className="font-medium">{names}</span> {typingUsers.length === 1 ? 'is' : 'are'} typing…
      </span>
    </motion.div>
  );
});
TypingIndicator.displayName = 'TypingIndicator';

// ─── DATE SEPARATOR ───────────────────────────────────────────────────────────
export const DateSeparator = memo(({ label }) => (
  <div className="flex items-center gap-3 my-4 px-4" role="separator" aria-label={label}>
    <div className="flex-1 h-px" style={{ background: 'var(--base-300)' }} />
    <span
      className="text-[11px] font-medium px-2.5 py-1 rounded-full whitespace-nowrap"
      style={{ background: 'var(--base-200)', color: 'var(--base-content)', opacity: 0.7 }}
    >
      {label}
    </span>
    <div className="flex-1 h-px" style={{ background: 'var(--base-300)' }} />
  </div>
));
DateSeparator.displayName = 'DateSeparator';