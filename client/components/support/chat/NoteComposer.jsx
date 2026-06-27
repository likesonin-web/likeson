'use client';

/**
 * components/support/chat/NoteComposer.jsx
 * Thin, explicitly-named wrapper around MessageComposer in 'note' mode —
 * kept as its own component per the brief so call sites read clearly as
 * "the internal note composer" rather than a generic composer instance.
 */
import MessageComposer from './MessageComposer';
import { createInternalNote } from '../../../store/slices/supportSlice';
import { useDispatch } from 'react-redux';

export default function NoteComposer({ ticketId, currentUserId }) {
  const dispatch = useDispatch();

  const handleSend = ({ message, attachments }) => {
    dispatch(createInternalNote({ ticketId, note: message, attachments }));
  };

  return <MessageComposer ticketId={ticketId} currentUserId={currentUserId} mode="note" onSend={handleSend} />;
}
