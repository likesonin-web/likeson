'use client';

import { useRef, useState } from 'react';
import {
  Phone, Video, Search, MoreVertical, ArrowLeft,
  BellOff, Bell, Archive, Trash2, ShieldBan, Users,
  Image as ImageIcon, Pin,
} from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';
import Avatar from './Avatar';
import { getConversationDisplay, formatLastSeen } from '@/lib/chatHelpers';

export default function ChatHeader({
  conversation, currentUser, permissions, typingNames, onBack,
  onCall, onVideoCall, onSearch, onOpenInfo, onMute, onArchive,
  onClear, onBlock, onOpenMedia, onOpenPinned,
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenuOpen(false));

  const display = getConversationDisplay(conversation, currentUser?._id);
  const myParticipant = conversation.participants?.find(
    (p) => (p.user?._id || p.user)?.toString() === currentUser?._id?.toString(),
  );
  const isMuted = myParticipant?.isMuted;

  const statusLine = typingNames?.length
    ? `${typingNames[0]}${typingNames.length > 1 ? ` +${typingNames.length - 1}` : ''} typing…`
    : conversation.type === 'direct'
      ? display.online ? 'Online' : formatLastSeen(display.lastseen)
      : display.subtitle;

  return (
    <div className="flex items-center gap-3 px-3 sm:px-4 py-3 border-b border-base-300 bg-base-100 shrink-0">
      <button type="button" onClick={onBack} className="btn btn-ghost btn-circle md:hidden shrink-0" aria-label="Back">
        <ArrowLeft className="w-5 h-5" />
      </button>

      <button type="button" onClick={onOpenInfo} className="flex items-center gap-3 min-w-0 flex-1 text-left">
        <Avatar
          src={display.avatar}
          name={display.name}
          size="sm"
          online={conversation.type === 'direct' ? display.online : undefined}
        />
        <div className="min-w-0">
          <p className="font-bold text-sm truncate">{display.name}</p>
          <p className={`text-xs truncate ${typingNames?.length ? 'text-primary' : 'text-base-content/50'}`}>
            {statusLine}
          </p>
        </div>
      </button>

      <div className="flex items-center gap-0.5 shrink-0">
        {permissions.canCall && (
          <button type="button" onClick={onCall} className="btn btn-ghost btn-circle" aria-label="Voice call">
            <Phone className="w-5 h-5" />
          </button>
        )}
        {permissions.canVideoCall && (
          <button type="button" onClick={onVideoCall} className="btn btn-ghost btn-circle" aria-label="Video call">
            <Video className="w-5 h-5" />
          </button>
        )}
        <button type="button" onClick={onSearch} className="btn btn-ghost btn-circle" aria-label="Search">
          <Search className="w-5 h-5" />
        </button>

        <div className="relative" ref={menuRef}>
          <button type="button" onClick={() => setMenuOpen((v) => !v)} className="btn btn-ghost btn-circle" aria-label="More options">
            <MoreVertical className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-56 bg-base-100 border border-base-300 rounded-box shadow-lg overflow-hidden z-30 py-1 text-sm">
              {conversation.type === 'group' && (
                <MenuRow icon={Users} label="Group info" onClick={() => { onOpenInfo(); setMenuOpen(false); }} />
              )}
              <MenuRow
                icon={isMuted ? Bell : BellOff}
                label={isMuted ? 'Unmute' : 'Mute notifications'}
                onClick={() => { onMute(!isMuted); setMenuOpen(false); }}
              />
              <MenuRow
                icon={ImageIcon}
                label="Shared media"
                onClick={() => { onOpenMedia?.(); setMenuOpen(false); }}
              />
              <MenuRow
                icon={Pin}
                label="Pinned messages"
                onClick={() => { onOpenPinned?.(); setMenuOpen(false); }}
              />
              {permissions.canArchive && (
                <MenuRow icon={Archive} label="Archive chat" onClick={() => { onArchive(); setMenuOpen(false); }} />
              )}
              {permissions.canClear && (
                <MenuRow icon={Trash2} label="Clear chat" tone="error" onClick={() => { onClear(); setMenuOpen(false); }} />
              )}
              {permissions.canBlock && (
                <MenuRow icon={ShieldBan} label="Block user" tone="error" onClick={() => { onBlock(); setMenuOpen(false); }} />
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MenuRow({ icon: Icon, label, onClick, tone }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-base-200 transition-colors ${tone === 'error' ? 'text-error' : 'text-base-content'}`}
    >
      <Icon className="w-4 h-4" /> {label}
    </button>
  );
}
