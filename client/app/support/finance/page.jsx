'use client';

/**
 * app/support/finance/page.jsx — Finance / Admin / SuperAdmin.
 * Server-side, finance-role list calls already auto-scope to
 * department: 'FINANCE' (see routes/support/tickets.routes.js GET /tickets),
 * so this page simply renders the workspace with that department filter
 * pre-applied for non-finance staff browsing the queue intentionally.
 */
import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { Wallet } from 'lucide-react';

import { setTicketFilters } from '../../../store/slices/supportSlice';
import RoleGuard from '../../../components/support/RoleGuard';
import EmptyState from '../../../components/support/EmptyState';
import TicketWorkspace from '../../../components/support/tickets/TicketWorkspace';

export default function FinanceQueuePage() {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(setTicketFilters({ department: 'FINANCE' }));
    return () => dispatch(setTicketFilters({ department: '' }));
  }, [dispatch]);

  return (
    <RoleGuard
      permission="viewFinanceQueue"
      fallback={<EmptyState icon={Wallet} title="Restricted" description="The Finance Queue is for Finance, Admin, and SuperAdmin." />}
    >
      <TicketWorkspace ticketId={null} scope="all" />
    </RoleGuard>
  );
}
