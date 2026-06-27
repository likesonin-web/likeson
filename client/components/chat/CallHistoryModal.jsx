'use client';

import { useEffect } from 'react';
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Video, Phone } from 'lucide-react';
import Modal from './Modal';
import Avatar from './Avatar';
import { formatDuration } from '@/lib/chatHelpers';

export default function CallHistoryModal({ open, onClose, calls = [], currentUserId, loadCallHistory }) {
  useEffect(() => {
    if (open) loadCallHistory();
  }, [open, loadCallHistory]);

  return (
    <Modal open={open} onClose={onClose} title="Call history" maxWidth="max-w-md">
      {calls.length === 0 ? (
        <p className="text-center text-sm text-base-content/50 py-8">No calls yet.</p>
      ) : (
        <div className="space-y-1">
          {calls.map((call) => {
            const isOutgoing = (call.initiator?._id || call.initiator)?.toString() === currentUserId?.toString();
            const missed = ['missed', 'declined', 'cancelled'].includes(call.status);
            const other = call.participants?.find((p) => (p.user?._id || p.user)?.toString() !== currentUserId?.toString())?.user;

            return (
              <div key={call._id} className="flex items-center gap-3 px-2 py-2.5 rounded-field hover:bg-base-200">
                <Avatar src={other?.avatar} name={other?.name} size="sm" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{other?.name || 'Unknown'}</p>
                  <p className={`text-xs flex items-center gap-1 ${missed ? 'text-error' : 'text-base-content/50'}`}>
                    {missed ? <PhoneMissed className="w-3 h-3" /> : isOutgoing ? <PhoneOutgoing className="w-3 h-3" /> : <PhoneIncoming className="w-3 h-3" />}
                    {missed ? call.status : formatDuration(call.duration)}
                  </p>
                </div>
                {call.type === 'video' ? <Video className="w-4 h-4 text-base-content/40" /> : <Phone className="w-4 h-4 text-base-content/40" />}
                <span className="text-[11px] text-base-content/40">
                  {new Date(call.createdAt).toLocaleDateString([], { day: '2-digit', month: 'short' })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}
