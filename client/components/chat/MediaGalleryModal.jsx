'use client';

import { useEffect, useState } from 'react';
import { FileText, Music, Video as VideoIcon, Image as ImageIcon, X, Download } from 'lucide-react';
import Modal from './Modal';
import { useConversationMedia } from '@/hooks/useChat';

const TABS = ['all', 'image', 'video', 'audio', 'file'];

export default function MediaGalleryModal({ open, onClose, conversationId, loadMedia }) {
  const media = useConversationMedia(conversationId);
  const [loading, setLoading] = useState(false);
  const [tab, setTab] = useState('all');
  const [lightbox, setLightbox] = useState(null);

  useEffect(() => {
    if (!open || !conversationId) return;
    setLoading(true);
    loadMedia(conversationId, { limit: 100 })
      .finally(() => setLoading(false));
  }, [open, conversationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = tab === 'all' ? media : media.filter((m) => m.type === tab);

  return (
    <Modal open={open} onClose={onClose} title="Shared media & files" maxWidth="max-w-lg">
      {/* Tabs */}
      <div className="flex gap-1 mb-4 overflow-x-auto pb-1 scrollbar-thin">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-full text-xs font-semibold capitalize whitespace-nowrap shrink-0 transition-colors ${
              tab === t
                ? 'bg-primary text-primary-content'
                : 'bg-base-200 text-base-content/60 hover:bg-base-300'
            }`}
          >
            {t === 'all' ? 'All' : t === 'image' ? 'Photos' : t === 'video' ? 'Videos' : t === 'audio' ? 'Audio' : 'Files'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-3 gap-2">
          {Array.from({ length: 9 }).map((_, i) => (
            <div key={i} className="skeleton aspect-square rounded-field" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-base-content/40">
          <ImageIcon className="w-10 h-10" />
          <p className="text-sm">No {tab === 'all' ? 'shared media' : tab + 's'} yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-96 overflow-y-auto scrollbar-thin">
          {filtered.map((msg) => (
            <MediaThumb key={msg._id} msg={msg} onExpand={setLightbox} />
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[80] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 btn btn-circle btn-sm bg-white/10 text-white"
            onClick={() => setLightbox(null)}
          >
            <X className="w-4 h-4" />
          </button>
          <a
            href={lightbox.media?.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            className="absolute top-4 left-4 btn btn-circle btn-sm bg-white/10 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <Download className="w-4 h-4" />
          </a>
          {lightbox.type === 'image' && (
            <img
              src={lightbox.media?.url}
              alt=""
              className="max-w-full max-h-full object-contain rounded-box"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {lightbox.type === 'video' && (
            <video
              src={lightbox.media?.url}
              controls
              autoPlay
              className="max-w-full max-h-full rounded-box"
              onClick={(e) => e.stopPropagation()}
            />
          )}
          {lightbox.type === 'audio' && (
            <audio
              src={lightbox.media?.url}
              controls
              autoPlay
              className="w-full max-w-sm"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
    </Modal>
  );
}

function MediaThumb({ msg, onExpand }) {
  const canExpand = ['image', 'video', 'audio'].includes(msg.type);

  const inner = (
    <div className="aspect-square rounded-field overflow-hidden bg-base-200 flex items-center justify-center group relative">
      {msg.type === 'image' && (
        <img src={msg.media?.url} alt="" className="w-full h-full object-cover" loading="lazy" />
      )}
      {msg.type === 'video' && (
        <>
          {msg.media?.thumbnail
            ? <img src={msg.media.thumbnail} alt="" className="w-full h-full object-cover" loading="lazy" />
            : <VideoIcon className="w-7 h-7 text-base-content/40" />}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center">
              <VideoIcon className="w-4 h-4 text-white" />
            </div>
          </div>
        </>
      )}
      {msg.type === 'audio' && <Music className="w-7 h-7 text-base-content/40" />}
      {msg.type === 'file' && (
        <div className="flex flex-col items-center gap-1 p-2 text-center">
          <FileText className="w-7 h-7 text-primary" />
          <span className="text-[10px] text-base-content/60 truncate w-full px-1">
            {msg.media?.fileName || 'File'}
          </span>
        </div>
      )}
      {canExpand && (
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
      )}
    </div>
  );

  if (!canExpand) {
    return (
      <a href={msg.media?.url} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    );
  }

  return (
    <button type="button" onClick={() => onExpand(msg)} className="w-full text-left">
      {inner}
    </button>
  );
}
