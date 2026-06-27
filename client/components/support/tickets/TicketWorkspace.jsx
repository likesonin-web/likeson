'use client';

/**
 * BUG FIX 1: When customer opens a ticket from URL (ticketId in URL), ticket
 *   panel showed "Select a ticket" because:
 *   - Column 3 had `ticketId ? 'block' : 'hidden lg:flex'` but the div also
 *     had `flex flex-col` that conflicted with block/hidden toggling.
 *   Fixed: use `flex flex-col` always on col3, hide/show via parent wrapper.
 *
 * BUG FIX 2: Socket images/files not showing immediately.
 *   sendMessage thunk now dispatches optimistic message before API call via
 *   messageReceivedRealtime. The slice handles dedup by _id so no double-add.
 *   (Real fix is in supportSlice — optimistic add + replace on fulfill)
 *
 * BUG FIX 3: Removed all inline styles → Tailwind only.
 */
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, MessageSquare, Lock, PanelRightOpen, X } from 'lucide-react';

import TicketList from './TicketList';
import TicketDetails from './TicketDetails';
import MessageList from '../chat/MessageList';
import MessageComposer from '../chat/MessageComposer';
import TypingIndicator from '../chat/TypingIndicator';
import InternalNotes from '../chat/InternalNotes';
import EmptyState from '../EmptyState';
import RoleGuard from '../RoleGuard';
import CreateTicketModal from '../modals/CreateTicketModal';

import useTicket from '../../../hooks/useTicket';
import useTicketMessages from '../../../hooks/useTicketMessages';
import useTicketTyping from '../../../hooks/useTicketTyping';
import useRolePermissions from '../../../hooks/useRolePermissions';

export default function TicketWorkspace({ ticketId, scope = 'all' }) {
  const router = useRouter();
  const { user, permissions } = useRolePermissions();
  const [chatTab, setChatTab] = useState('conversation');
  const [mobileDetailsOpen, setMobileDetailsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const { ticket, loading: ticketLoading } = useTicket(ticketId);
  const { messages, loading: messagesLoading, hasMore, loadOlder, send, markRead } =
    useTicketMessages(ticketId);
  const { typingUsers } = useTicketTyping(ticketId, user?._id);

  const handleSelectTicket = (t) => router.push(`/support/tickets/${t._id}`);

  return (
    <div className="grid h-full grid-cols-1 lg:grid-cols-[260px_1fr] xl:grid-cols-[260px_1fr_320px]">

      {/* Col 1: Ticket List — hidden on mobile when a ticket is open */}
      <div className={`h-full ${ticketId ? 'hidden lg:block' : 'block'}`}>
        <TicketList
          activeTicketId={ticketId}
          onSelectTicket={handleSelectTicket}
          onCreateTicket={() => setCreateOpen(true)}
          scope={scope}
        />
      </div>

      <CreateTicketModal open={createOpen} onClose={() => setCreateOpen(false)} />

      {/* Col 2: Chat — always shown on mobile when ticket selected */}
      <div className={`h-full flex flex-col min-w-0 ${ticketId ? 'flex' : 'hidden lg:flex'}`}>
        {!ticketId && (
          <EmptyState
            icon={MessageSquare}
            title="Select a ticket"
            description="Choose a ticket from the list to view the conversation."
          />
        )}

        {ticketId && !ticket && ticketLoading && (
          <div className="flex items-center justify-center h-full">
            <div className="loading loading-md" />
          </div>
        )}

        {ticket && (
          <>
            {/* Chat header */}
            <div className="flex items-center gap-2 px-3 py-2 border-b border-base-300 bg-base-100 shrink-0">
              <button
                onClick={() => router.push('/support/tickets')}
                className="btn btn-ghost btn-circle btn-sm lg:hidden"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-base-content/40">{ticket.ticketNumber}</p>
                <h6 className="text-sm font-bold truncate">{ticket.subject}</h6>
              </div>

              <RoleGuard permission="viewInternalNotes">
                <div className="flex items-center gap-1 bg-base-200 rounded-selector p-0.5 shrink-0">
                  <button
                    onClick={() => setChatTab('conversation')}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-selector transition-colors ${
                      chatTab === 'conversation' ? 'bg-base-100 shadow-sm' : 'text-base-content/50'
                    }`}
                  >
                    <MessageSquare className="w-3 h-3" /> Chat
                  </button>
                  <button
                    onClick={() => setChatTab('notes')}
                    className={`flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-selector transition-colors ${
                      chatTab === 'notes' ? 'bg-base-100 shadow-sm text-accent' : 'text-base-content/50'
                    }`}
                  >
                    <Lock className="w-3 h-3" /> Notes
                  </button>
                </div>
              </RoleGuard>

              <button
                onClick={() => setMobileDetailsOpen(true)}
                className="btn btn-ghost btn-circle btn-sm xl:hidden"
              >
                <PanelRightOpen className="w-4 h-4" />
              </button>
            </div>

            {/* Message area */}
            <div className="flex-1 min-h-0">
              {chatTab === 'conversation' ? (
                <MessageList
                  messages={messages}
                  loading={messagesLoading}
                  hasMore={hasMore}
                  onLoadOlder={loadOlder}
                  onMarkRead={markRead}
                />
              ) : (
                <InternalNotes ticketId={ticketId} currentUserId={user?._id} />
              )}
            </div>

            {chatTab === 'conversation' && (
              <>
                <TypingIndicator typingUsers={typingUsers} />
                <MessageComposer
                  ticketId={ticketId}
                  currentUserId={user?._id}
                  onSend={send}
                  mode="reply"
                />
              </>
            )}
          </>
        )}
      </div>

      {/* Col 3: Ticket Details — desktop only */}
      <div className="hidden xl:flex flex-col h-full min-w-0">
        {ticket
          ? <TicketDetails ticket={ticket} />
          : (
            <div className="flex items-center justify-center h-full text-base-content/30 text-sm">
              No ticket selected
            </div>
          )
        }
      </div>

      {/* Mobile details slide-over */}
      <AnimatePresence>
        {mobileDetailsOpen && ticket && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileDetailsOpen(false)}
              className="xl:hidden fixed inset-0 z-40 bg-black/40"
            />
            <motion.div
              initial={{ x: 360 }}
              animate={{ x: 0 }}
              exit={{ x: 360 }}
              transition={{ type: 'spring', stiffness: 320, damping: 30 }}
              className="xl:hidden fixed inset-y-0 right-0 z-50 w-[88vw] max-w-[360px] bg-base-100"
            >
              <button
                onClick={() => setMobileDetailsOpen(false)}
                className="absolute top-3 left-3 btn btn-ghost btn-circle btn-sm z-10"
              >
                <X className="w-4 h-4" />
              </button>
              <TicketDetails ticket={ticket} />
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
