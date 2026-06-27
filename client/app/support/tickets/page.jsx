'use client';

/**
 * app/support/tickets/page.jsx — Ticket List (no ticket selected yet)
 * Reads ?scope= from the URL to drive "All / Mine / Assigned" per the
 * sidebar's nav items (see lib/permissions.getVisibleNavItems).
 */
import { useSearchParams } from 'next/navigation';
import TicketWorkspace from '@/components/support/tickets/TicketWorkspace';

export default function TicketListPage() {
  const searchParams = useSearchParams();
  const scope = searchParams.get('scope') || 'all';

  return <TicketWorkspace ticketId={null} scope={scope} />;
}
