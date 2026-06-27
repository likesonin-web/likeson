'use client';

/**
 * components/support/chat/InternalNotes.jsx
 * Admin/Finance/SuperAdmin-only note thread — separate styling/background
 * from the customer-facing chat, and a separate permission layer enforced
 * both here (RoleGuard) and server-side (requireRoles in messages.routes.js).
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Lock } from 'lucide-react';

import { fetchInternalNotes, selectInternalNotesFor } from '../../../store/slices/supportSlice';
import RoleGuard from '../RoleGuard';
import NoteComposer from './NoteComposer';
import EmptyState from '../EmptyState';
import AttachmentGallery from './AttachmentGallery';
import { displayName, initials } from '../../../lib/supportutils';
import useRolePermissions from '../../../hooks/useRolePermissions';

function NoteCard({ note, index }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      className="rounded-field border border-accent/30 bg-accent/5 p-3 space-y-1.5"
    >
      <div className="flex items-center gap-2">
        <div className="avatar">
          <div className="w-6 h-6 placeholder text-[10px] bg-accent/20 text-accent"><span>{initials(displayName(note.author))}</span></div>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold truncate">{displayName(note.author)}</p>
          <p className="text-[10px] text-base-content/40">{format(new Date(note.createdAt), 'MMM d, h:mm a')}</p>
        </div>
      </div>
      <p className="text-sm whitespace-pre-wrap break-words">{note.note}</p>
      {!!note.attachments?.length && <AttachmentGallery attachments={note.attachments} compact />}
    </motion.div>
  );
}

export default function InternalNotes({ ticketId, currentUserId }) {
  const dispatch = useDispatch();
  const { items, loading } = useSelector(selectInternalNotesFor(ticketId));
  const { permissions } = useRolePermissions();

  useEffect(() => {
    if (ticketId) dispatch(fetchInternalNotes({ ticketId }));
  }, [ticketId, dispatch]);

  return (
    <RoleGuard
      permission="viewInternalNotes"
      fallback={
        <EmptyState icon={Lock} title="Restricted" description="Internal notes are visible to admin, finance, and superadmin only." />
      }
    >
      <div className="flex h-full flex-col bg-accent/[0.03]">
        <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-accent/20 bg-accent/5">
          <Lock className="w-3.5 h-3.5 text-accent" />
          <span className="text-xs font-bold text-accent uppercase tracking-wide">Internal Notes</span>
        </div>

        <div className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-3">
          {loading && items.length === 0 && <p className="text-xs text-base-content/40 text-center py-6">Loading notes…</p>}
          {!loading && items.length === 0 && (
            <EmptyState title="No internal notes" description="Notes here are never visible to the customer or partner." />
          )}
          {items.map((note, i) => <NoteCard key={note._id} note={note} index={i} />)}
        </div>

        {permissions.createInternalNote && <NoteComposer ticketId={ticketId} currentUserId={currentUserId} />}
      </div>
    </RoleGuard>
  );
}
