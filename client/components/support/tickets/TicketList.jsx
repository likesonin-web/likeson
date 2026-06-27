'use client';

/**
 * components/support/tickets/TicketList.jsx
 * Column 2 of the workspace grid. Virtualized (react-virtuoso) so it stays
 * smooth at 100,000+ tickets per the performance brief. Infinite scroll
 * triggers fetchTickets({ page: page+1 }) via endReached.
 */
import { useEffect, useMemo } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { useDispatch, useSelector } from 'react-redux';
import { useDebounce } from 'react-use';
import { Plus } from 'lucide-react';

import {
  fetchTickets,
  setTicketFilters,
  resetTicketFilters,
  selectTicketsState,
  selectTicketFilters,
} from '../../../store/slices/supportSlice';
import useRolePermissions from '../../../hooks/useRolePermissions';
import TicketCard from './TicketCard';
import TicketFilters from './TicketFilters';
import { TicketListSkeleton } from '../LoadingSkeleton';
import EmptyState from '../EmptyState';
import ErrorState from '../ErrorState';
import { Inbox } from 'lucide-react';

export default function TicketList({ activeTicketId, onSelectTicket, onCreateTicket, scope = 'all' }) {
  const dispatch = useDispatch();
  const { items, pagination, loading, error } = useSelector(selectTicketsState);
  const filters = useSelector(selectTicketFilters);
  const { permissions } = useRolePermissions();

  const queryParams = useMemo(
    () => ({
      page: 1,
      limit: filters.limit,
      status: filters.status || undefined,
      priority: filters.priority || undefined,
      department: filters.department || undefined,
      search: filters.search || undefined,
      startDate: filters.startDate || undefined,
      endDate: filters.endDate || undefined,
    }),
    [filters]
  );

  // Refetch (page 1) whenever filters/scope change — debounced for search typing
  useDebounce(
    () => {
      dispatch(fetchTickets(queryParams));
    },
    300,
    [JSON.stringify(queryParams), scope]
  );

  useEffect(() => {
    dispatch(setTicketFilters({ scope }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  const loadMore = () => {
    if (loading || pagination.page >= pagination.pages) return;
    dispatch(fetchTickets({ ...queryParams, page: pagination.page + 1 }));
  };

  if (error) return <ErrorState message={error} onRetry={() => dispatch(fetchTickets(queryParams))} />;

  return (
    <div className="flex h-full flex-col border-r border-base-300 bg-base-100">
      <div className="flex items-center justify-between px-3 py-3 border-b border-base-300">
        <h6 className="font-bold text-sm">
          Tickets <span className="text-base-content/40 font-medium">({pagination.total})</span>
        </h6>
        {permissions.createTicket && (
          <button onClick={onCreateTicket} className="btn btn-primary btn-xs">
            <Plus className="w-3.5 h-3.5" /> New
          </button>
        )}
      </div>

      <input
        value={filters.search}
        onChange={(e) => dispatch(setTicketFilters({ search: e.target.value }))}
        placeholder="Search this list…"
        className="input-field rounded-none border-x-0 border-t-0"
      />

      <TicketFilters
        filters={filters}
        onChange={(patch) => dispatch(setTicketFilters(patch))}
        onReset={() => dispatch(resetTicketFilters())}
      />

      <div className="flex-1 min-h-0">
        {loading && items.length === 0 && <TicketListSkeleton />}

        {!loading && items.length === 0 && (
          <EmptyState icon={Inbox} title="No tickets found" description="Try adjusting your filters or search." />
        )}

        {items.length > 0 && (
          <Virtuoso
            data={items}
            endReached={loadMore}
            overscan={400}
            itemContent={(_, ticket) => (
              <div className="px-2 py-1">
                <TicketCard
                  ticket={ticket}
                  active={ticket._id === activeTicketId}
                  onClick={() => onSelectTicket(ticket)}
                />
              </div>
            )}
            components={{
              Footer: () =>
                loading ? <div className="py-3 text-center text-xs text-base-content/40">Loading more…</div> : null,
            }}
          />
        )}
      </div>
    </div>
  );
}
