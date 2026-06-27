'use client';

/**
 * hooks/useTicketTyping.js
 * Debounced typing-event emitter + reader for the typing indicator strip.
 */
import { useCallback, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { selectTypingUsersFor } from '../store/slices/supportSlice';
import useSupportSocket from './useSupportSocket';
import { TYPING_DEBOUNCE_MS } from '../lib/supportconstants';

export default function useTicketTyping(ticketId, currentUserId) {
  const typingMap = useSelector(selectTypingUsersFor(ticketId));
  const { startTyping, stopTyping } = useSupportSocket();
  const timeoutRef = useRef(null);

  const notifyTyping = useCallback(() => {
    startTyping(ticketId);
    clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => stopTyping(ticketId), TYPING_DEBOUNCE_MS);
  }, [ticketId, startTyping, stopTyping]);

  useEffect(() => () => clearTimeout(timeoutRef.current), []);

  const typingUsers = Object.entries(typingMap)
    .filter(([userId]) => userId !== currentUserId)
    .map(([userId, userName]) => ({ userId, userName }));

  return { typingUsers, notifyTyping };
}
