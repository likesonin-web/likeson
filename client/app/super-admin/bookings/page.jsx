'use client';

import { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, Download, RefreshCw, ChevronLeft, ChevronRight,
  Layers, Shield, Zap, ChevronDown, ChevronUp, X, BarChart2,
  HelpCircle,
} from 'lucide-react';
import {
  fetchAdminBookings, exportAdminBookings,
  resetAdminStatusUpdate, resetAdminAssignment,
  resetAdminRefund, resetAdminOpStatusUpdate,
  selectAdminBookings, selectAdminBookingsMeta,
  selectAdminBookingsLoading, selectAdminExportLoading,
  selectAdminStatusUpdate, selectAdminAssignment,
  selectAdminRefund, selectAdminOpStatusUpdate,
} from '@/store/slices/operationsSlice';
import { selectCurrentUser } from '@/store/slices/userSlice';
import { BookingCard, AnalysisSection } from './BookingCardAndAnalysis';
import { BookingDetailPanel } from './BookingDetailPanel';
import { HelpSection } from './HelpSection';
import { BOOKING_TYPES, BOOKING_STATUSES, Spinner, EmptyState } from './shared';
import { FileText } from 'lucide-react';

/* ─── MAIN PAGE ────────────────────────────────────────────────────────────── */
export default function BookingsManagement() {
  const dispatch = useDispatch();
  const user     = useSelector(selectCurrentUser);

  const bookings      = useSelector(selectAdminBookings);
  const meta          = useSelector(selectAdminBookingsMeta);
  const listLoading   = useSelector(selectAdminBookingsLoading);
  const exportLoading = useSelector(selectAdminExportLoading);

  const adminStatusUpdate   = useSelector(selectAdminStatusUpdate);
  const adminAssignment     = useSelector(selectAdminAssignment);
  const adminRefund         = useSelector(selectAdminRefund);
  const adminOpStatusUpdate = useSelector(selectAdminOpStatusUpdate);

  const [selectedId,    setSelectedId]    = useState(null);
  const [search,        setSearch]        = useState('');
  const [filterStatus,  setFilterStatus]  = useState('');
  const [filterType,    setFilterType]    = useState('');
  const [filterFrom,    setFilterFrom]    = useState('');
  const [filterTo,      setFilterTo]      = useState('');
  const [page,          setPage]          = useState(1);
  const [section,       setSection]       = useState('bookings');
  const [filtersOpen,   setFiltersOpen]   = useState(false);
  // tab to auto-navigate to in detail panel (from help section)
  const [helpNavTab,    setHelpNavTab]    = useState(null);

  const loadBookings = useCallback(() => {
    dispatch(fetchAdminBookings({
      page, limit: 18,
      status:      filterStatus || undefined,
      bookingType: filterType   || undefined,
      search:      search       || undefined,
      from:        filterFrom   || undefined,
      to:          filterTo     || undefined,
    }));
  }, [dispatch, page, filterStatus, filterType, search, filterFrom, filterTo]);

  useEffect(() => {
    if (adminStatusUpdate)   { loadBookings(); dispatch(resetAdminStatusUpdate()); }
  }, [adminStatusUpdate]); // eslint-disable-line

  useEffect(() => {
    if (adminAssignment)     { loadBookings(); dispatch(resetAdminAssignment()); }
  }, [adminAssignment]); // eslint-disable-line

  useEffect(() => {
    if (adminRefund)         { loadBookings(); dispatch(resetAdminRefund()); }
  }, [adminRefund]); // eslint-disable-line

  useEffect(() => {
    if (adminOpStatusUpdate) { dispatch(resetAdminOpStatusUpdate()); }
  }, [adminOpStatusUpdate, dispatch]);

  useEffect(() => { loadBookings(); }, [loadBookings]);

  const handleExport = () => dispatch(exportAdminBookings({
    from: filterFrom || undefined, to: filterTo || undefined,
    status: filterStatus || undefined, bookingType: filterType || undefined,
  }));

  const hasActiveFilters = filterStatus || filterType || filterFrom || filterTo || search;

  // Help section action button → navigate to booking section + specific tab
  const handleHelpNavigate = (target) => {
    if (target === 'bookings' || target === 'analysis') {
      setSection(target);
    } else {
      // It's a tab ID — switch to bookings, set tab
      setSection('bookings');
      setHelpNavTab(target);
    }
  };

  const NAV_ITEMS = [
    { id: 'bookings', label: 'Bookings', icon: Layers    },
    { id: 'analysis', label: 'Analysis', icon: BarChart2 },
    { id: 'help',     label: 'Help',     icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-poppins">

      {/* ── TOP NAV ── */}
      <header className="sticky top-0 z-40 bg-base-100/90 backdrop-blur-strong border-b border-base-300">
        <div className="flex items-center justify-between px-6 py-2.5">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center shadow-md">
                <Shield size={14} className="text-primary-content" />
              </div>
              <div>
                <p className="text-xs font-bold text-base-content m-0 leading-none">Likeson Admin</p>
                <p className="text-[9px] text-base-content/40 m-0 leading-none mt-0.5">Bookings Management</p>
              </div>
            </div>

            <div className="flex items-center gap-1 bg-base-200 border border-base-300 rounded-xl p-1">
              {NAV_ITEMS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSection(id)}
                  className={`btn btn-sm gap-1.5 ${id === section ? 'btn-primary' : 'btn-ghost'}`}
                >
                  <Icon size={11} /> {label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] text-base-content/50 hidden sm:block">
              {user?.name ?? 'Admin'} · {user?.role}
            </span>
            <span className="badge badge-primary gap-1">
              <Zap size={9} /> {meta?.total ?? 0} bookings
            </span>
          </div>
        </div>
      </header>

      {/* ── BOOKINGS SECTION ── */}
      <AnimatePresence mode="wait">
        {section === 'bookings' && (
          <motion.div
            key="bookings"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex"
            style={{ height: 'calc(100vh - 53px)' }}
          >
            {/* LEFT: filters + list */}
            <div className="w-96 shrink-0 flex flex-col border-r border-base-300 overflow-hidden">

              {/* Filters */}
              <div className="shrink-0 p-4 border-b border-base-300 bg-base-200/60 flex flex-col gap-2.5">
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/35 pointer-events-none" />
                  <input
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                    placeholder="Search code or patient name…"
                    className="input-field pl-9 text-xs"
                  />
                </div>

                <button
                  onClick={() => setFiltersOpen(p => !p)}
                  className={`btn btn-sm gap-1.5 w-full justify-between ${hasActiveFilters ? 'btn-primary' : 'bg-base-300 text-base-content'}`}
                >
                  <div className="flex items-center gap-1.5">
                    <Filter size={10} />
                    Filters
                    {hasActiveFilters && <span className="badge badge-xs">Active</span>}
                  </div>
                  {filtersOpen ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                </button>

                <AnimatePresence>
                  {filtersOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="flex flex-col gap-2 pt-1">
                        <div className="grid grid-cols-2 gap-2">
                          <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }} className="input-field text-xs">
                            <option value="">All statuses</option>
                            {BOOKING_STATUSES.map((s) => <option key={s} value={s}>{s.replace(/_/g, ' ')}</option>)}
                          </select>
                          <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }} className="input-field text-xs">
                            <option value="">All types</option>
                            {BOOKING_TYPES.map((t) => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
                          </select>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <input type="date" value={filterFrom} onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }} className="input-field text-xs" />
                          <input type="date" value={filterTo}   onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}   className="input-field text-xs" />
                        </div>
                        {hasActiveFilters && (
                          <button
                            onClick={() => { setFilterStatus(''); setFilterType(''); setFilterFrom(''); setFilterTo(''); setSearch(''); setPage(1); }}
                            className="btn btn-xs gap-1 text-error bg-error/10 border-error/20 hover:bg-error/20 w-full"
                          >
                            <X size={9} /> Clear all filters
                          </button>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="flex gap-2">
                  <button onClick={loadBookings} className="btn btn-sm flex-1 gap-1.5 bg-base-300 text-base-content">
                    {listLoading ? <Spinner size={11} /> : <RefreshCw size={11} />}
                    {listLoading ? 'Loading…' : 'Refresh'}
                  </button>
                  <button onClick={handleExport} disabled={exportLoading} className="btn btn-primary btn-sm flex-1 gap-1.5">
                    {exportLoading ? <Spinner size={11} /> : <Download size={11} />}
                    Export CSV
                  </button>
                </div>
              </div>

              {/* Booking list */}
              <div className="flex-1 overflow-y-auto p-3 scrollbar-thin">
                <AnimatePresence>
                  {listLoading && (bookings?.length ?? 0) === 0
                    ? Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="skeleton h-24 rounded-2xl mb-2" />
                      ))
                    : (bookings?.length ?? 0) === 0
                    ? <EmptyState icon={FileText} text="No bookings found" sub="Try adjusting your search or filters" />
                    : (bookings ?? []).map((b) => (
                        <BookingCard
                          key={b._id}
                          booking={b}
                          selected={b._id === selectedId}
                          onClick={() => {
                            setSelectedId(b._id === selectedId ? null : b._id);
                            setHelpNavTab(null);
                          }}
                        />
                      ))
                  }
                </AnimatePresence>
              </div>

              {/* Pagination */}
              {(meta?.pages ?? 0) > 1 && (
                <div className="shrink-0 flex items-center justify-between px-4 py-2.5 border-t border-base-300 bg-base-200/60">
                  <p className="text-[10px] text-base-content/45 m-0">Page {page} of {meta.pages} · {meta.total} total</p>
                  <div className="flex gap-1">
                    <button disabled={page <= 1}           onClick={() => setPage(p => p-1)} className="btn btn-ghost btn-sm btn-circle"><ChevronLeft  size={12} /></button>
                    <button disabled={page >= meta.pages}  onClick={() => setPage(p => p+1)} className="btn btn-ghost btn-sm btn-circle"><ChevronRight size={12} /></button>
                  </div>
                </div>
              )}
            </div>

            {/* RIGHT: detail panel */}
            <div className="flex-1 overflow-hidden">
              <BookingDetailPanel
                bookingId={selectedId}
                dispatch={dispatch}
                onTabNavigate={helpNavTab}
              />
            </div>
          </motion.div>
        )}

        {section === 'analysis' && (
          <motion.div
            key="analysis"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-y-auto scrollbar-thin"
            style={{ height: 'calc(100vh - 53px)' }}
          >
            <AnalysisSection dispatch={dispatch} />
          </motion.div>
        )}

        {section === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="overflow-y-auto scrollbar-thin"
            style={{ height: 'calc(100vh - 53px)' }}
          >
            <HelpSection onNavigate={handleHelpNavigate} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
