'use client';

import { useEffect, useState, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Eye,
  CheckCircle2,
  UserCheck,
  Beaker,
  Upload,
  Send,
  Flag,
  XCircle,
  Loader2,
  Clock,
  RefreshCw,
  CalendarDays,
  MapPin,
  TestTube2,
  X,
  AlertTriangle,
  FileCheck2,
  ChevronDown,
  User,
  Phone,
  IndianRupee,
} from 'lucide-react';

import {
  fetchBookings,
  fetchBookingDetails,
  acceptBooking,
  assignTechnician,
  collectSample,
  uploadReport,
  dispatchReport,
  completeBooking,
  rejectBooking,
  clearCurrentBooking,
  selectAllBookings,
  selectBookingsPagination,
  selectIsLoadingList,
  selectCurrentBooking,
  selectIsLoadingDetails,
  selectIsActionLoading,
  selectLabError,
  selectBookingsGroupedByStatus,
  selectPendingBookings,
  selectActiveBookings,
} from '@/store/slices/labPartnerBookingSlice';

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: '',           label: 'All Status' },
  { value: 'pending',    label: 'Pending' },
  { value: 'confirmed',  label: 'Confirmed' },
  { value: 'in_progress',label: 'In Progress' },
  { value: 'completed',  label: 'Completed' },
  { value: 'cancelled',  label: 'Cancelled' },
  { value: 'no_show',    label: 'No Show' },
];

const DATE_OPTIONS = [
  { value: '',      label: 'All Time' },
  { value: 'today', label: 'Today' },
  { value: 'week',  label: 'This Week' },
  { value: 'month', label: 'This Month' },
];

const MODE_OPTIONS = [
  { value: '',                label: 'All Modes' },
  { value: 'Home Collection', label: 'Home Collection' },
  { value: 'Walk-in',         label: 'Walk-in' },
];

const STATUS_BADGE = {
  pending:     'badge badge-warning',
  payment_pending: 'badge badge-warning',
  confirmed:   'badge badge-info',
  in_progress: 'badge badge-primary',
  completed:   'badge badge-success',
  cancelled:   'badge badge-error',
  no_show:     'badge badge-error',
};

const STATUS_LABEL = {
  pending:         'Pending',
  payment_pending: 'Payment Pending',
  confirmed:       'Confirmed',
  in_progress:     'In Progress',
  completed:       'Completed',
  cancelled:       'Cancelled',
  no_show:         'No Show',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmt(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function fmtTime(dateStr) {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

// ─── Booking detail drawer ────────────────────────────────────────────────────

function BookingDetailDrawer({ booking, onClose, isActionLoading, dispatch }) {
  const [techName, setTechName]         = useState(booking?.diagnosticDetails?.technicianName || '');
  const [rejectReason, setRejectReason] = useState('');
  const [uploadFile, setUploadFile]     = useState(null);
  const [showReject, setShowReject]     = useState(false);

  if (!booking) return null;

  const id     = booking._id;
  const status = booking.status;

  const handleAccept  = () => dispatch(acceptBooking(id));
  const handleAssign  = () => techName.trim() && dispatch(assignTechnician({ bookingId: id, technicianName: techName }));
  const handleCollect = () => dispatch(collectSample(id));
  const handleUpload  = () => uploadFile && dispatch(uploadReport({ bookingId: id, file: uploadFile }));
  const handleDispatch= () => dispatch(dispatchReport(id));
  const handleComplete= () => dispatch(completeBooking(id));
  const handleReject  = () => rejectReason.trim() && dispatch(rejectBooking({ bookingId: id, reason: rejectReason }));

  const canAccept   = ['pending', 'payment_pending'].includes(status);
  const canAssign   = !['completed', 'cancelled', 'no_show'].includes(status);
  const canCollect  = status === 'confirmed';
  const canUpload   = !['cancelled', 'no_show'].includes(status);
  const canDispatch = !!booking.diagnosticDetails?.reportUrl && !['cancelled', 'no_show'].includes(status);
  const canComplete = status === 'in_progress';
  const canReject   = ['pending', 'payment_pending'].includes(status);

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-neutral/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <motion.div
        className="relative z-10 bg-base-100 w-full sm:max-w-2xl max-h-[92vh] overflow-y-auto rounded-t-2xl sm:rounded-2xl border border-base-300 shadow-depth-lg"
        initial={{ y: 60, opacity: 0 }}
        animate={{ y: 0,  opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
      >
        {/* Header */}
        <div className="sticky top-0 bg-base-100 border-b border-base-300 px-5 py-4 flex items-center justify-between z-10">
          <div>
            <h3 className="font-display font-extrabold text-base-content text-md">
              {booking.bookingCode}
            </h3>
            <span className={STATUS_BADGE[status]}>
              {STATUS_LABEL[status] || status}
            </span>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 space-y-5">

          {/* Patient info */}
          <section className="card p-4 space-y-3">
            <p className="rx-section-title">Patient Info</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><p className="rx-label">Name</p><p className="rx-value">{booking.patientInfo?.name}</p></div>
              <div><p className="rx-label">Age / Gender</p><p className="rx-value">{booking.patientInfo?.age} / {booking.patientInfo?.gender}</p></div>
              <div><p className="rx-label">Phone</p><p className="rx-value">{booking.patientInfo?.phone || '—'}</p></div>
              <div><p className="rx-label">Blood Group</p><p className="rx-value">{booking.patientInfo?.bloodGroup || '—'}</p></div>
            </div>
          </section>

          {/* Booking info */}
          <section className="card p-4 space-y-3">
            <p className="rx-section-title">Booking Details</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
              <div><p className="rx-label">Scheduled</p><p className="rx-value">{fmt(booking.scheduledAt)} {fmtTime(booking.scheduledAt)}</p></div>
              <div><p className="rx-label">Mode</p><p className="rx-value">{booking.bookingType === 'diagnostic_home' ? 'Home Collection' : 'Walk-in'}</p></div>
              <div><p className="rx-label">Payment</p><p className="rx-value capitalize">{booking.paymentStatus}</p></div>
              <div><p className="rx-label">Amount</p><p className="rx-value">₹{booking.fareBreakdown?.totalAmount?.toLocaleString('en-IN') || '0'}</p></div>
              <div className="col-span-2">
                <p className="rx-label">Tests / Packages</p>
                <p className="rx-value">
                  {[...(booking.diagnosticDetails?.testNames || []), ...(booking.diagnosticDetails?.packageNames || [])].join(', ') || '—'}
                </p>
              </div>
              {booking.diagnosticDetails?.technicianName && (
                <div><p className="rx-label">Technician</p><p className="rx-value">{booking.diagnosticDetails.technicianName}</p></div>
              )}
              {booking.diagnosticDetails?.sampleCollectedAt && (
                <div><p className="rx-label">Sample Collected</p><p className="rx-value">{fmt(booking.diagnosticDetails.sampleCollectedAt)}</p></div>
              )}
              {booking.diagnosticDetails?.reportUrl && (
                <div className="col-span-2">
                  <p className="rx-label">Report URL</p>
                  <a href={booking.diagnosticDetails.reportUrl} target="_blank" rel="noreferrer" className="text-primary text-[10px] underline break-all">View Report</a>
                </div>
              )}
            </div>
          </section>

          {/* Actions */}
          <section className="card p-4 space-y-4">
            <p className="rx-section-title">Actions</p>

            {/* Accept */}
            {canAccept && (
              <div className="flex items-center gap-3">
                <button onClick={handleAccept} disabled={isActionLoading} className="btn btn-success gap-2 text-xs">
                  {isActionLoading ? <Loader2 size={15} className="animate-spin" /> : <CheckCircle2 size={15} />}
                  Accept Booking
                </button>
              </div>
            )}

            {/* Assign technician */}
            {canAssign && (
              <div className="flex items-center gap-2">
                <input
                  className="input-field text-xs flex-1"
                  placeholder="Technician name"
                  value={techName}
                  onChange={e => setTechName(e.target.value)}
                />
                <button onClick={handleAssign} disabled={isActionLoading || !techName.trim()} className="btn btn-primary btn-sm gap-1.5">
                  {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <UserCheck size={14} />}
                  Assign
                </button>
              </div>
            )}

            {/* Collect sample */}
            {canCollect && (
              <button onClick={handleCollect} disabled={isActionLoading} className="btn btn-info gap-2 text-xs">
                {isActionLoading ? <Loader2 size={15} className="animate-spin" /> : <Beaker size={15} />}
                Mark Sample Collected
              </button>
            )}

            {/* Upload report */}
            {canUpload && (
              <div className="flex items-center gap-2 flex-wrap">
                <label className="btn btn-outline btn-sm gap-1.5 cursor-pointer">
                  <Upload size={14} />
                  {uploadFile ? uploadFile.name : 'Choose Report PDF'}
                  <input type="file" accept=".pdf,image/*" className="hidden" onChange={e => setUploadFile(e.target.files[0])} />
                </label>
                {uploadFile && (
                  <button onClick={handleUpload} disabled={isActionLoading} className="btn btn-primary btn-sm gap-1.5">
                    {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Upload size={14} />}
                    Upload
                  </button>
                )}
              </div>
            )}

            {/* Dispatch report */}
            {canDispatch && (
              <button onClick={handleDispatch} disabled={isActionLoading} className="btn btn-accent gap-2 text-xs">
                {isActionLoading ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
                Dispatch Report ({booking.diagnosticDetails?.reportDeliveryMode || 'Default'})
              </button>
            )}

            {/* Complete */}
            {canComplete && (
              <button onClick={handleComplete} disabled={isActionLoading} className="btn btn-success gap-2 text-xs">
                {isActionLoading ? <Loader2 size={15} className="animate-spin" /> : <FileCheck2 size={15} />}
                Mark Complete
              </button>
            )}

            {/* Reject */}
            {canReject && (
              <div className="space-y-2">
                <button
                  onClick={() => setShowReject(p => !p)}
                  className="btn btn-ghost btn-sm gap-1.5 text-error"
                >
                  <XCircle size={14} />
                  Reject Booking
                </button>
                <AnimatePresence>
                  {showReject && (
                    <motion.div
                      className="space-y-2"
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                    >
                      <textarea
                        className="input-field resize-none text-xs"
                        rows={2}
                        placeholder="Reason for rejection (required)"
                        value={rejectReason}
                        onChange={e => setRejectReason(e.target.value)}
                      />
                      <button
                        onClick={handleReject}
                        disabled={isActionLoading || !rejectReason.trim()}
                        className="btn btn-error btn-sm gap-1.5"
                      >
                        {isActionLoading ? <Loader2 size={14} className="animate-spin" /> : <Flag size={14} />}
                        Confirm Reject
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </section>

          {/* Status log */}
          {booking.statusLog?.length > 0 && (
            <section className="card p-4 space-y-3">
              <p className="rx-section-title">Status History</p>
              <div className="space-y-2">
                {[...booking.statusLog].reverse().map((log, i) => (
                  <div key={i} className="flex items-start gap-3 text-[10px]">
                    <div className="w-1.5 h-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                    <div>
                      <span className="font-semibold capitalize">{log.fromStatus} → {log.toStatus}</span>
                      {log.reason && <span className="text-base-content/50 ml-1">— {log.reason}</span>}
                      <p className="text-base-content/40">{fmt(log.changedAt)} {fmtTime(log.changedAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

        </div>
      </motion.div>
    </motion.div>
  );
}

// ─── Booking row ──────────────────────────────────────────────────────────────

function BookingRow({ booking, onView }) {
  const tests = [
    ...(booking.diagnosticDetails?.testNames    || []),
    ...(booking.diagnosticDetails?.packageNames || []),
  ].slice(0, 2);

  const extra = [
    ...(booking.diagnosticDetails?.testNames    || []),
    ...(booking.diagnosticDetails?.packageNames || []),
  ].length - 2;

  return (
    <motion.tr
      layout
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      <td>
        <div>
          <p className="font-bold text-primary text-xs">{booking.bookingCode}</p>
          <p className="text-[10px] text-base-content/40">
            {booking.bookingType === 'diagnostic_home' ? (
              <span className="flex items-center gap-1"><MapPin size={10} /> Home</span>
            ) : (
              <span className="flex items-center gap-1"><TestTube2 size={10} /> Walk-in</span>
            )}
          </p>
        </div>
      </td>
      <td>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <User size={13} className="text-primary" />
          </div>
          <div>
            <p className="text-xs font-semibold">{booking.patientInfo?.name}</p>
            <p className="text-[10px] text-base-content/40 flex items-center gap-1">
              <Phone size={9} />{booking.patientInfo?.phone || '—'}
            </p>
          </div>
        </div>
      </td>
      <td>
        <div className="flex flex-wrap gap-1">
          {tests.map((t, i) => (
            <span key={i} className="badge badge-xs badge-primary">{t}</span>
          ))}
          {extra > 0 && <span className="badge badge-xs bg-base-300 text-base-content/60">+{extra}</span>}
          {tests.length === 0 && <span className="text-[10px] text-base-content/30">—</span>}
        </div>
      </td>
      <td>
        <div>
          <p className="text-xs font-medium flex items-center gap-1"><CalendarDays size={12} className="text-base-content/40" />{fmt(booking.scheduledAt)}</p>
          <p className="text-[10px] text-base-content/40">{fmtTime(booking.scheduledAt)}</p>
        </div>
      </td>
      <td>
        <span className={STATUS_BADGE[booking.status] || 'badge'}>
          {STATUS_LABEL[booking.status] || booking.status}
        </span>
      </td>
      <td>
        <div className="flex items-center gap-1">
          <IndianRupee size={12} className="text-base-content/40" />
          <span className="text-xs font-semibold">{booking.fareBreakdown?.totalAmount?.toLocaleString('en-IN') || '0'}</span>
        </div>
        <p className="text-[10px] text-base-content/40 capitalize">{booking.paymentStatus}</p>
      </td>
      <td>
        <button onClick={() => onView(booking._id)} className="btn btn-ghost btn-xs gap-1 text-primary">
          <Eye size={13} /> View
        </button>
      </td>
    </motion.tr>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ManageBookings() {
  const dispatch        = useDispatch();
  const bookings        = useSelector(selectAllBookings);
  const pagination      = useSelector(selectBookingsPagination);
  const isLoading       = useSelector(selectIsLoadingList);
  const currentBooking  = useSelector(selectCurrentBooking);
  const isLoadingDetail = useSelector(selectIsLoadingDetails);
  const isActionLoading = useSelector(selectIsActionLoading);
  const error           = useSelector(selectLabError);

  const [filters, setFilters] = useState({ status: '', date: '', collectionMode: '', page: 1 });
  const [drawerOpen, setDrawerOpen] = useState(false);

  // fetch on filter/page change
  useEffect(() => {
    const params = {};
    if (filters.status)         params.status         = filters.status;
    if (filters.date)           params.date           = filters.date;
    if (filters.collectionMode) params.collectionMode = filters.collectionMode;
    params.page = filters.page;
    dispatch(fetchBookings(params));
  }, [dispatch, filters]);

  const handleView = useCallback((bookingId) => {
    dispatch(fetchBookingDetails(bookingId));
    setDrawerOpen(true);
  }, [dispatch]);

  const handleCloseDrawer = () => {
    setDrawerOpen(false);
    dispatch(clearCurrentBooking());
  };

  const setFilter = (key, val) => setFilters(prev => ({ ...prev, [key]: val, page: 1 }));
  const goPage    = (p) => setFilters(prev => ({ ...prev, page: p }));
  const refresh   = () => dispatch(fetchBookings({ ...filters }));

  const totalPages = pagination?.pages || 1;

  return (
    <div className="space-y-4">

      {/* ── Filter bar ── */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5 text-base-content/40">
            <Filter size={14} />
            <span className="text-[10px] font-semibold uppercase tracking-wider">Filters</span>
          </div>

          {/* Status */}
          <div className="relative">
            <select
              value={filters.status}
              onChange={e => setFilter('status', e.target.value)}
              className="input-field text-xs py-1.5 pr-8 appearance-none w-36"
            >
              {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          </div>

          {/* Date */}
          <div className="relative">
            <select
              value={filters.date}
              onChange={e => setFilter('date', e.target.value)}
              className="input-field text-xs py-1.5 pr-8 appearance-none w-36"
            >
              {DATE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          </div>

          {/* Collection mode */}
          <div className="relative">
            <select
              value={filters.collectionMode}
              onChange={e => setFilter('collectionMode', e.target.value)}
              className="input-field text-xs py-1.5 pr-8 appearance-none w-40"
            >
              {MODE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <ChevronDown size={13} className="absolute right-2 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
          </div>

          {/* Clear */}
          {(filters.status || filters.date || filters.collectionMode) && (
            <button
              onClick={() => setFilters({ status: '', date: '', collectionMode: '', page: 1 })}
              className="btn btn-ghost btn-xs gap-1 text-error"
            >
              <X size={12} /> Clear
            </button>
          )}

          <div className="flex-1" />

          <button onClick={refresh} disabled={isLoading} className="btn btn-ghost btn-sm gap-1.5">
            <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      {/* ── Error banner ── */}
      <AnimatePresence>
        {error && (
          <motion.div
            className="alert alert-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
          >
            <AlertTriangle size={16} />
            <span className="text-xs">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Table ── */}
      <div className="card overflow-hidden">
        {/* Count row */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-base-300 bg-base-200/50">
          <p className="text-[10px] text-base-content/50 font-semibold">
            {pagination?.total ?? 0} bookings found
          </p>
          {isLoading && <Loader2 size={14} className="animate-spin text-primary" />}
        </div>

        <div className="overflow-x-auto">
          <table className="table w-full">
            <thead>
              <tr>
                <th>Booking</th>
                <th>Patient</th>
                <th>Tests / Packages</th>
                <th>Scheduled</th>
                <th>Status</th>
                <th>Amount</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && bookings.length === 0 ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <td key={j}><div className="skeleton h-4 w-full" /></td>
                    ))}
                  </tr>
                ))
              ) : bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-14">
                    <Clock size={32} className="text-base-content/20 mx-auto mb-2" />
                    <p className="text-xs text-base-content/40 font-medium">No bookings found</p>
                    <p className="text-[10px] text-base-content/30 mt-1">Try adjusting your filters</p>
                  </td>
                </tr>
              ) : (
                <AnimatePresence>
                  {bookings.map(b => (
                    <BookingRow key={b._id} booking={b} onView={handleView} />
                  ))}
                </AnimatePresence>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-base-300">
            <p className="text-[10px] text-base-content/40">
              Page {pagination?.page} of {totalPages}
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => goPage(filters.page - 1)}
                disabled={filters.page <= 1 || isLoading}
                className="btn btn-ghost btn-xs"
              >
                <ChevronLeft size={14} />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const p = filters.page <= 3 ? i + 1 : filters.page - 2 + i;
                if (p < 1 || p > totalPages) return null;
                return (
                  <button
                    key={p}
                    onClick={() => goPage(p)}
                    className={`btn btn-xs ${p === filters.page ? 'btn-primary' : 'btn-ghost'}`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => goPage(filters.page + 1)}
                disabled={filters.page >= totalPages || isLoading}
                className="btn btn-ghost btn-xs"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Detail Drawer ── */}
      <AnimatePresence>
        {drawerOpen && (
          <BookingDetailDrawer
            booking={isLoadingDetail ? null : currentBooking}
            onClose={handleCloseDrawer}
            isActionLoading={isActionLoading}
            dispatch={dispatch}
          />
        )}
        {drawerOpen && isLoadingDetail && (
          <motion.div
            className="fixed inset-0 z-50 flex items-center justify-center bg-neutral/50 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <div className="bg-base-100 rounded-2xl p-6 flex items-center gap-3 shadow-depth-lg">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-xs font-medium">Loading booking details…</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}