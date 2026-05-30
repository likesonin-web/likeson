'use client';
import { Mic, MicOff, Monitor, Hand, MoreVertical, UserX } from 'lucide-react';
import { useState } from 'react';
import { AvatarWithStatus } from '../shared/AvatarWithStatus';
import { RoleBadge }        from '../shared/RoleBadge';
import { canMuteOthers, canKickParticipants } from '../../utils/roleHelpers';

export function ParticipantCard({ participant, viewerRole, onMute, onKick }) {
  const [menuOpen, setMenuOpen] = useState(false);

  const isConnected  = participant.connectionStatus === 'connected';
  const isScreenShare = participant.screenSharing;
  const isHandRaised  = participant.handRaised;
  const isMuted       = participant.isMutedByHost;
  const showActions   = canMuteOthers(viewerRole) || canKickParticipants(viewerRole);

  return (
    <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-base-200 transition-colors group">
      <AvatarWithStatus
  name={participant.name || participant.displayName}
  isOnline={isConnected}
  size="sm"
/>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
         <span className="text-sm font-semibold text-base-content truncate">
  {participant.name || participant.displayName || 'Unknown'}
</span>
          {isHandRaised && <Hand size={12} className="text-warning shrink-0" aria-label="Hand raised" />}
        </div>
        <RoleBadge role={participant.role} size="xs" />
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {isScreenShare && <Monitor size={13} className="text-info" aria-label="Sharing screen" />}
        {isMuted
          ? <MicOff size={13} className="text-error"         aria-label="Muted by host" />
          : <Mic    size={13} className="text-base-content/40" aria-label="Mic on" />
        }

        {showActions && (
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="btn btn-xs btn-circle btn-ghost opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label="Participant actions"
            >
              <MoreVertical size={12} />
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full mt-1 w-36 bg-base-100 border border-base-300 rounded-lg shadow-depth z-10 py-1">
                {canMuteOthers(viewerRole) && (
                  <button
                    onClick={() => { onMute(participant.userId, !isMuted); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm hover:bg-base-200 transition-colors flex items-center gap-2"
                  >
                    {isMuted ? <Mic size={13} /> : <MicOff size={13} />}
                    {isMuted ? 'Unmute' : 'Mute'}
                  </button>
                )}
                {canKickParticipants(viewerRole) && (
                  <button
                    onClick={() => { onKick(participant); setMenuOpen(false); }}
                    className="w-full text-left px-3 py-1.5 text-sm text-error hover:bg-error/10 transition-colors flex items-center gap-2"
                  >
                    <UserX size={13} />
                    Remove
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
