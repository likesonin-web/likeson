'use client';

/**
 * app/support/analytics/page.jsx — Admin / Finance / SuperAdmin only.
 */
import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { format } from 'date-fns';
import { Inbox, AlertTriangle, Clock, Star, ShieldAlert } from 'lucide-react';

import {
  fetchAnalyticsOverview,
  fetchAdminPerformance,
  fetchPartnerTrends,
  fetchCustomerTrends,
  fetchTopTags,
  fetchSlaBreachReport,
  selectAnalytics,
} from '../../../store/slices/supportSlice';
import RoleGuard from '../../../components/support/RoleGuard';
import EmptyState from '../../../components/support/EmptyState';
import { STATUS_LABELS, STATUS_BADGE, DEPARTMENT_LABELS } from '../../../lib/supportconstants';
import { cn, displayName } from '../../../lib/supportutils';

function StatCard({ label, value, icon: Icon, tone = 'primary' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="stat-card"
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="stat-card-value" style={{ color: `var(--${tone})` }}>{value}</p>
        <Icon style={{ width: '1.75rem', height: '1.75rem', color: `var(--${tone})`, opacity: 0.8, flexShrink: 0 }} />
      </div>
      <p className="stat-card-label">{label}</p>
    </motion.div>
  );
}

function HorizontalBar({ label, value, max, tone = 'primary', suffix = '' }) {
  const pct = max ? Math.round((value / max) * 100) : 0;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem' }}>
        <span style={{ fontWeight: 600, color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>{label}</span>
        <span style={{ fontWeight: 700, color: 'var(--base-content)' }}>{value}{suffix}</span>
      </div>
      <div className="progress-bar">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="progress-bar-fill"
          style={tone !== 'primary' ? { background: `var(--${tone})` } : undefined}
        />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const dispatch = useDispatch();
  const { overview, adminPerformance, partnerTrends, customerTrends, topTags, slaBreachReport, loading } =
    useSelector(selectAnalytics);
  const [range, setRange] = useState(30);

  useEffect(() => {
    const params = { startDate: new Date(Date.now() - range * 86_400_000).toISOString() };
    dispatch(fetchAnalyticsOverview(params));
    dispatch(fetchAdminPerformance(params));
    dispatch(fetchPartnerTrends(params));
    dispatch(fetchCustomerTrends(params));
    dispatch(fetchTopTags(params));
    dispatch(fetchSlaBreachReport({ ...params, limit: 10 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range]);

  const maxResolved = Math.max(1, ...adminPerformance.map((a) => a.resolved));
  const maxPartner  = Math.max(1, ...partnerTrends.map((t) => t.count));
  const maxTag      = Math.max(1, ...topTags.map((t) => t.count));

  return (
    <RoleGuard
      permission="viewAnalytics"
      fallback={
        <EmptyState
          icon={ShieldAlert}
          title="Restricted"
          description="Analytics is available to Admin, Finance, and SuperAdmin."
        />
      }
    >
      <div
        className="scrollbar-thin"
        style={{ height: '100%', overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '2rem' }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <h2 style={{ fontWeight: 800 }}>Support Analytics</h2>
            <p className="section-subheading" style={{ marginBottom: 0 }}>
              Operational health across the last {range} days.
            </p>
          </div>
          <select
            value={range}
            onChange={(e) => setRange(Number(e.target.value))}
            className="input-field"
            style={{ width: 'auto' }}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        </div>

        {/* Overview stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Tickets"  value={overview?.tickets?.total                                                  ?? '—'} icon={Inbox}        tone="info"    />
          <StatCard label="SLA Breaches"   value={overview?.sla?.breaches                                                   ?? '—'} icon={AlertTriangle} tone="error"   />
          <StatCard label="Avg Resolution" value={overview?.performance?.avgResolutionHours ? `${overview.performance.avgResolutionHours}h` : '—'} icon={Clock} tone="warning" />
          <StatCard label="Avg Rating"     value={overview?.rating?.avg                     ? `${overview.rating.avg} / 5` : '—'} icon={Star}         tone="success" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status breakdown */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Tickets by Status</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(overview?.tickets?.byStatus || {}).map(([status, count]) => (
                <div key={status} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <span className={cn('badge badge-sm', STATUS_BADGE[status])}>{STATUS_LABELS[status] || status}</span>
                  <span style={{ fontSize: '0.875rem', fontWeight: 700 }}>{count}</span>
                </div>
              ))}
              {!Object.keys(overview?.tickets?.byStatus || {}).length && (
                <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
                  {loading ? 'Loading…' : 'No data for this period.'}
                </p>
              )}
            </div>
          </div>

          {/* Agent performance */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Agent Performance — Resolved Tickets</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {adminPerformance.slice(0, 6).map((p) => (
                <HorizontalBar key={p.admin._id} label={displayName(p.admin)} value={p.resolved} max={maxResolved} />
              ))}
              {!adminPerformance.length && (
                <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>No assigned tickets yet.</p>
              )}
            </div>
          </div>

          {/* Department breakdown */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Tickets by Department</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {Object.entries(overview?.tickets?.byDepartment || {}).map(([dept, count]) => (
                <HorizontalBar key={dept} label={DEPARTMENT_LABELS[dept] || dept} value={count} max={overview?.tickets?.total || 1} tone="secondary" />
              ))}
            </div>
          </div>

          {/* Top tags */}
          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Top Tags</h6>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {topTags.map((t) => (
                <motion.span
                  key={t._id}
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: Math.max(0.85, t.count / maxTag) }}
                  className="badge badge-primary"
                >
                  {t._id} · {t.count}
                </motion.span>
              ))}
              {!topTags.length && (
                <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>No tags recorded yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* Partner / customer trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Partner Support Trends</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {partnerTrends.slice(0, 8).map((t, i) => (
                <HorizontalBar
                  key={i}
                  label={`${displayName(t.partner)} · ${DEPARTMENT_LABELS[t._id.department] || t._id.department}`}
                  value={t.count}
                  max={maxPartner}
                  tone="accent"
                />
              ))}
              {!partnerTrends.length && (
                <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>No partner tickets yet.</p>
              )}
            </div>
          </div>

          <div className="card" style={{ padding: '1.25rem' }}>
            <h6 style={{ fontWeight: 700, marginBottom: '1rem' }}>Customer Support Trends</h6>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {customerTrends.map((t) => (
                <HorizontalBar
                  key={t._id}
                  label={DEPARTMENT_LABELS[t._id] || t._id}
                  value={t.count}
                  max={Math.max(1, ...customerTrends.map((c) => c.count))}
                  tone="info"
                />
              ))}
              {!customerTrends.length && (
                <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>No customer tickets yet.</p>
              )}
            </div>
          </div>
        </div>

        {/* SLA breach report */}
        <RoleGuard permission="changePriority">
          <div className="card" style={{ padding: '1.25rem', overflowX: 'auto' }}>
            <h6
              style={{
                fontWeight: 700,
                marginBottom: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              <AlertTriangle style={{ width: '1rem', height: '1rem', color: 'var(--error)' }} />
              SLA Breach Report
            </h6>
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Subject</th>
                  <th>Priority</th>
                  <th>Deadline</th>
                </tr>
              </thead>
              <tbody>
                {slaBreachReport.items.map((t) => (
                  <tr key={t._id}>
                    <td style={{ fontWeight: 600 }}>{t.ticketNumber}</td>
                    <td style={{ maxWidth: '20rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.subject}</td>
                    <td>{t.priority}</td>
                    <td>{t.slaDeadline ? format(new Date(t.slaDeadline), 'MMM d, h:mm a') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!slaBreachReport.items.length && (
              <p style={{ fontSize: '0.75rem', color: 'color-mix(in oklch, var(--base-content) 40%, transparent)', padding: '1rem 0' }}>
                No SLA breaches in this period. 🎉
              </p>
            )}
          </div>
        </RoleGuard>
      </div>
    </RoleGuard>
  );
}