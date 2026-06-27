'use client';

/**
 * app/support/page.jsx — Support Dashboard
 */
import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { Inbox, Clock, AlertTriangle, CheckCircle2, Plus } from 'lucide-react';

import useRolePermissions from '@/hooks/useRolePermissions';
import {
  fetchAnalyticsOverview,
  fetchTickets,
  selectAnalytics,
  selectTicketsState,
} from '@/store/slices/supportSlice';

import TicketCard from '@/components/support/tickets/TicketCard';
import { TicketListSkeleton } from '@/components/support/LoadingSkeleton';
import EmptyState from '@/components/support/EmptyState';
import RoleGuard from '@/components/support/RoleGuard';

function StatCard({ label, value, icon: Icon, tone = 'primary', delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="stat-card"
      style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
    >
      <div>
        <p className="stat-card-value" style={{ color: `var(--${tone})` }}>
          {value}
        </p>
        <p className="stat-card-label">{label}</p>
      </div>
      <Icon
        style={{
          width: '2rem',
          height: '2rem',
          color: `var(--${tone})`,
          opacity: 0.3,
          flexShrink: 0,
        }}
      />
    </motion.div>
  );
}

export default function SupportDashboardPage() {
  const dispatch = useDispatch();
  const router   = useRouter();
  const { permissions } = useRolePermissions();
  const { overview }    = useSelector(selectAnalytics);
  const { items: myTickets, loading: ticketsLoading } = useSelector(selectTicketsState);

  useEffect(() => {
    if (permissions.viewAnalytics) dispatch(fetchAnalyticsOverview());
    dispatch(fetchTickets({ page: 1, limit: 5 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [permissions.viewAnalytics]);

  return (
    <div
      className="scrollbar-thin"
      style={{ height: '100%', overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}
    >
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h2 style={{ fontWeight: 800 }}>Support Dashboard</h2>
          <p className="section-subheading" style={{ marginBottom: 0 }}>
            Welcome back — here's what's happening today.
          </p>
        </div>
        {permissions.createTicket && (
          <button onClick={() => router.push('/support/tickets')} className="btn btn-primary-cta">
            <Plus style={{ width: '1rem', height: '1rem' }} />
            New Ticket
          </button>
        )}
      </div>

      {/* Admin stats */}
      <RoleGuard permission="viewAnalytics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Open Tickets"       value={overview?.tickets?.byStatus?.OPEN      ?? '—'} icon={Inbox}        tone="info"    delay={0}    />
          <StatCard label="SLA Breaches"        value={overview?.sla?.breaches               ?? '—'} icon={AlertTriangle} tone="error"   delay={0.05} />
          <StatCard label="Avg. First Response" value={overview?.performance?.avgFirstResponseHours ? `${overview.performance.avgFirstResponseHours}h` : '—'} icon={Clock} tone="warning" delay={0.1} />
          <StatCard label="Resolved"            value={overview?.tickets?.byStatus?.RESOLVED  ?? '—'} icon={CheckCircle2} tone="success" delay={0.15} />
        </div>
      </RoleGuard>

      {/* Recent tickets */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <h5 style={{ fontWeight: 700, margin: 0 }}>
            {permissions.viewAllTickets ? 'Recent Activity' : 'Your Recent Tickets'}
          </h5>
          <button
            onClick={() => router.push('/support/tickets')}
            style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
          >
            View all →
          </button>
        </div>

        {ticketsLoading && myTickets.length === 0 && <TicketListSkeleton count={3} />}

        {!ticketsLoading && myTickets.length === 0 && (
          <EmptyState
            title="No tickets yet"
            description="Create a ticket to get help from the Likeson support team."
          />
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {myTickets.slice(0, 6).map((t) => (
            <TicketCard key={t._id} ticket={t} onClick={() => router.push(`/support/tickets/${t._id}`)} />
          ))}
        </div>
      </div>
    </div>
  );
}