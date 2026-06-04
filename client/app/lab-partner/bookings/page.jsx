'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FlaskConical,
  ClipboardList,
  Archive,
  BarChart3,
  RefreshCw,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  FileText,
  Calendar,
  AlertCircle,
} from 'lucide-react';

import {
  fetchDashboardStats,
  selectDashboardStats,
  selectIsLoadingStats,
} from '@/store/slices/labPartnerBookingSlice';

import ManageBookings from './ManageBookings';
import ReportsArchive from './ReportsArchive';
import BackButton from '../../../components/BackButton';

// ─── Tab config ───────────────────────────────────────────────────────────────

const TABS = [
  { id: 'bookings', label: 'Manage Bookings', icon: ClipboardList },
  { id: 'reports',  label: 'Reports Archive', icon: Archive },
];

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, colorClass, loading }) {
  return (
    <motion.div
      className="stat-card flex items-center gap-4"
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className={`w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0 ${colorClass}`}>
        <Icon size={20} />
      </div>
      <div>
        {loading ? (
          <div className="skeleton h-7 w-14 mb-1" />
        ) : (
          <p className="stat-card-value">{value ?? 0}</p>
        )}
        <p className="stat-card-label">{label}</p>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LabPartnerBookingManagement() {
  const dispatch = useDispatch();
  const stats    = useSelector(selectDashboardStats);
  const loading  = useSelector(selectIsLoadingStats);

  const [activeTab, setActiveTab] = useState('bookings');

  useEffect(() => {
    dispatch(fetchDashboardStats());
  }, [dispatch]);

  const handleRefreshStats = () => dispatch(fetchDashboardStats());

  const statCards = [
    { label: 'Total',        value: stats?.total,           icon: ClipboardList,  colorClass: 'bg-primary/10 text-primary'  },
    { label: 'Pending',      value: stats?.pending,         icon: AlertCircle,    colorClass: 'bg-warning/10 text-warning'  },
    { label: 'In Progress',  value: stats?.inProgress,      icon: Clock,          colorClass: 'bg-info/10 text-info'        },
    { label: 'Completed',    value: stats?.completed,       icon: CheckCircle2,   colorClass: 'bg-success/10 text-success'  },
    { label: 'Cancelled',    value: stats?.cancelled,       icon: XCircle,        colorClass: 'bg-error/10 text-error'      },
    { label: 'Reports Ready',value: stats?.reportsUploaded, icon: FileText,       colorClass: 'bg-accent/10 text-accent'    },
    { label: "Today's",      value: stats?.todayBookings,   icon: Calendar,       colorClass: 'bg-secondary/10 text-secondary'},
    { label: 'Week Revenue', value: stats?.weekRevenue != null ? `₹${stats.weekRevenue.toLocaleString('en-IN')}` : '₹0', icon: TrendingUp, colorClass: 'bg-primary/10 text-primary' },
  ];

  return (
    <div className="min-h-screen bg-base-100" data-theme="lab-partner">
      <BackButton className='m-3'  />
      {/* ── Header ── */}
      <div className="bg-base-100 border-b border-base-300 sticky top-0 z-40">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <FlaskConical size={22} className="text-primary" />
              </div>
              <div>
                <h1 className="font-display text-xl font-extrabold text-base-content leading-tight tracking-tight">
                  Lab Partner Portal
                </h1>
                <p className="text-xs text-base-content/50 font-medium">Booking &amp; Report Management</p>
              </div>
            </div>

            <button
              onClick={handleRefreshStats}
              disabled={loading}
              className="btn btn-ghost btn-sm gap-2"
              title="Refresh stats"
            >
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* ── Stats grid ── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 size={16} className="text-primary" />
            <h2 className="text-sm font-bold text-base-content/60 uppercase tracking-widest">Dashboard Overview</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-8 gap-3">
            {statCards.map((s) => (
              <StatCard key={s.label} {...s} loading={loading} />
            ))}
          </div>
        </section>

        {/* ── Tabs ── */}
        <div className="flex items-center gap-1 bg-base-200 p-1 rounded-xl w-fit">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 ${
                activeTab === id
                  ? 'bg-base-100 text-primary shadow-sm'
                  : 'text-base-content/55 hover:text-base-content'
              }`}
            >
              <Icon size={15} />
              {label}
            </button>
          ))}
        </div>

        {/* ── Tab content ── */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25 }}
          >
            {activeTab === 'bookings' ? <ManageBookings /> : <ReportsArchive />}
          </motion.div>
        </AnimatePresence>

      </div>
    </div>
  );
}