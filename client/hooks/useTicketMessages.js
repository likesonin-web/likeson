'use client';

/**
 * hooks/useTicketMessages.js
 * BUG FIX: initialLoadDone.current was a module-level ref — it never reset
 *   when navigating between tickets, so messages weren't refetched.
 *   Fixed by removing the ref guard and relying on ticketId change in dep array.
 * BUG FIX: import path updated to slices/supportSlice
 */
import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchMessages,
  sendMessage,
  markMessageRead,
  selectMessagesFor,
} from '../store/slices/supportSlice';
import useSupportSocket from './useSupportSocket';

export default function useTicketMessages(ticketId) {
  const dispatch = useDispatch();
  const { items, pagination, loading, error, hasMore } = useSelector(selectMessagesFor(ticketId));
  const { emitDelivered, emitRead } = useSupportSocket();

  // Fetch page 1 whenever the ticketId changes (covers initial load + navigation)
  useEffect(() => {
    if (!ticketId) return;
    dispatch(fetchMessages({ ticketId, page: 1 }));
  }, [ticketId, dispatch]);

  const loadOlder = useCallback(() => {
    if (!hasMore || loading) return;
    const nextPage = (pagination?.page || 1) + 1;
    dispatch(fetchMessages({ ticketId, page: nextPage }));
  }, [ticketId, hasMore, loading, pagination, dispatch]);

  const send = useCallback(
    (payload) => dispatch(sendMessage({ ticketId, ...payload })),
    [ticketId, dispatch]
  );

  const markRead = useCallback(
    (msgId) => {
      dispatch(markMessageRead({ ticketId, msgId }));
      emitRead(ticketId, msgId);
    },
    [ticketId, dispatch, emitRead]
  );

  const markDelivered = useCallback(
    (msgId) => emitDelivered(ticketId, msgId),
    [ticketId, emitDelivered]
  );

  return { messages: items, loading, error, hasMore, loadOlder, send, markRead, markDelivered };
}
