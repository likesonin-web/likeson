'use client';

/**
 * @file TypingIndicator.jsx
 * @desc Animated typing indicator bubble
 *
 * USAGE in ChatWindow — add just above the <div ref={msgEndRef} /> sentinel:
 *
 *   import TypingIndicator from '@/components/chat/TypingIndicator';
 *   import { useSocketChat } from '@/hooks/useSocketChat';
 *
 *   // inside ChatWindow:
 *   const { typingInActive } = useSocketChat();
 *
 *   // In JSX (just before msgEndRef div):
 *   <TypingIndicator typingUserIds={typingInActive} participants={conv?.participants} />
 *   <div ref={msgEndRef} />
 *
 * USAGE in MessageInput — wire typing emit to textarea:
 *
 *   const { emitTypingInActive, emitStopTypingInActive } = useSocketChat();
 *
 *   <textarea
 *     onChange={e => { setText(e.target.value); emitTypingInActive(); }}
 *     onBlur={emitStopTypingInActive}
 *     onKeyDown={e => {
 *       if (e.key === 'Enter' && !e.shiftKey) { emitStopTypingInActive(); handleSend(); }
 *     }}
 *   />
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useMemo } from 'react';

const uid = (obj) => (obj && typeof obj === 'object' ? obj._id : obj);

const getInitials = (name = '') =>
  name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

export default function TypingIndicator({ typingUserIds = [], participants = [] }) {
  const typingParticipants = useMemo(() => {
    if (!typingUserIds.length) return [];
    return typingUserIds
      .map(userId =>
        participants.find(p => uid(p.user) === userId)?.user || { _id: userId, name: '…' }
      )
      .filter(Boolean)
      .slice(0, 3); // cap at 3 visible avatars
  }, [typingUserIds, participants]);

  return (
    <AnimatePresence>
      {typingParticipants.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 8, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 8, scale: 0.95 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex items-end gap-2 mb-2"
        >
          {/* Stacked avatars */}
          <div className="flex -space-x-1.5 flex-shrink-0 self-end mb-1">
            {typingParticipants.map((user, i) => (
              <div key={user._id}
                className="w-6 h-6 rounded-full overflow-hidden border-2 border-base-100 bg-primary/10 flex-shrink-0"
                style={{ zIndex: 10 - i }}>
                {user.avatar
                  ? <img src={user.avatar} alt="" className="w-full h-full object-cover" />
                  : <div className="w-full h-full flex items-center justify-center text-[8px] font-black text-primary">
                      {getInitials(user.name)}
                    </div>}
              </div>
            ))}
          </div>

          {/* Bubble */}
          <div className="flex flex-col items-start">
            {typingParticipants.length <= 2 && (
              <span className="text-[10px] text-base-content/40 mb-0.5 ml-1 font-medium">
                {typingParticipants.map(u => u.name).join(' & ')}
                {typingParticipants.length === 1 ? ' is' : ' are'} typing
              </span>
            )}
            {typingParticipants.length > 2 && (
              <span className="text-[10px] text-base-content/40 mb-0.5 ml-1 font-medium">
                Several people are typing
              </span>
            )}

            {/* Animated dots bubble */}
            <div className="px-3.5 py-2.5 bg-base-200 border border-base-300/40 rounded-2xl rounded-tl-sm flex items-center gap-1">
              {[0, 1, 2].map(i => (
                <motion.div
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-base-content/40"
                  animate={{ y: [0, -4, 0], opacity: [0.4, 1, 0.4] }}
                  transition={{
                    duration: 0.9,
                    repeat: Infinity,
                    delay: i * 0.18,
                    ease: 'easeInOut',
                  }}
                />
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}