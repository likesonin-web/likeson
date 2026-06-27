'use client';

/**
 * app/support/tickets/[ticketId]/page.jsx — Ticket Details (workspace open)
 */
import { useParams, useSearchParams } from 'next/navigation';
import TicketWorkspace from '@/components/support/tickets/TicketWorkspace';

export default function TicketDetailPage() {
  const { ticketId } = useParams();
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') || 'all';

  return <TicketWorkspace ticketId={ticketId} scope={scope} />;
}
