'use client';

/**
 * hooks/useTicket.js
 * BUG FIX: import path was `../store/supportSlice` (missing `slices/`)
 * BUG FIX: initialLoadDone ref prevented refetch when navigating between tickets
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchTicketById, selectCurrentTicket, clearCurrentTicket } from '../store/slices/supportSlice';
import useSupportSocket from './useSupportSocket';

export default function useTicket(ticketId) {
  const dispatch = useDispatch();
  const { data, loading, error } = useSelector(selectCurrentTicket);
  const { joinTicket, leaveTicket } = useSupportSocket();

  useEffect(() => {
    if (!ticketId) return undefined;
    // Always fetch fresh when ticketId changes (no stale-ref guard here)
    dispatch(fetchTicketById(ticketId));
    joinTicket(ticketId);

    return () => {
      leaveTicket(ticketId);
      dispatch(clearCurrentTicket());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticketId]);

  const refetch = () => dispatch(fetchTicketById(ticketId));

  return { ticket: data, loading, error, refetch };
}
