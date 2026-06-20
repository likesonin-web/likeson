'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import toast from 'react-hot-toast';
import {
    IndianRupee, TrendingUp, TrendingDown, Wallet as WalletIcon,
    Package, Stethoscope, CreditCard, RefreshCw, Search, Filter,
    ChevronLeft, ChevronRight, X, Calendar, ArrowUpRight, ArrowDownRight,
    CheckCircle2, XCircle, Clock, AlertTriangle, ChevronDown,
    Banknote, Receipt, ShieldCheck, Users, ExternalLink, Download,
} from 'lucide-react';

import {
    fetchPharmacyOrders,
    fetchFinancialLedger,
    fetchBillingSummary,
    processPharmacyRefund,
    processBookingRefund,
    selectPharmacyOrders,
    selectFinancialLedger,
    selectBillingAnalytics,
    selectRefundState,
    resetRefundStatus,
} from '@/store/slices/superadminSlice'; // adjust path to actual slice location

import API from '@/store/api'; // adjust path

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ════════════════════════════════════════════════════════════════════════════

const CHART_COLORS = ['var(--color-chart-1)', 'var(--color-chart-2)', 'var(--color-chart-3)', 'var(--color-chart-4)', 'var(--color-chart-5)', 'var(--color-chart-6)'];

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const TABS = [
    { key: 'pharmacy', label: 'Pharmacy Orders', icon: Package },
    { key: 'bookings', label: 'Healthcare Bookings', icon: Stethoscope },
    { key: 'ledger', label: 'Wallet Ledger', icon: WalletIcon },
];

const PHARMACY_PAYMENT_STATUSES = ['Pending', 'Paid', 'Failed', 'Refunded', 'Partially_Refunded'];
const PHARMACY_DELIVERY_STATUSES = [
    'Placed', 'Confirmed', 'Processing', 'Out-for-Delivery', 'Delivered',
    'Cancelled', 'Return_Requested', 'Return_Accepted', 'Return_Rejected',
    'Pickup_Assigned', 'Pickup_Done', 'Returned',
];
const PAYMENT_METHODS_PHARMACY = ['Razorpay', 'Wallet', 'COD'];

const BOOKING_STATUSES = [
    'draft', 'payment_pending', 'pending', 'confirmed', 'in_progress',
    'completed', 'cancelled', 'no_show', 'refund_pending', 'refunded',
];
const BOOKING_PAYMENT_STATUSES = [
    'unpaid', 'pending', 'payment_pending', 'paid', 'partially_paid',
    'failed', 'refunded', 'pending_cash', 'partially_refunded', 'waived',
    'pay_at_service_pending', 'pay_at_service_paid',
];
const BOOKING_TYPES = [
    'full_care_ride', 'doctor_consultation', 'doctor_online', 'physiotherapist',
    'care_assistant', 'diagnostic_center', 'diagnostic_home', 'patient_transport', 'follow_up',
];

const LEDGER_TYPES = ['Credit', 'Debit'];
const LEDGER_PURPOSES = [
    'Add_Money', 'Booking_Payment', 'Medicine_Purchase', 'Refund', 'Referral_Bonus',
    'Subscription_Fee', 'Coin_Conversion', 'Admin_Credit', 'Admin_Debit',
    'Cashback', 'Withdrawal_Debit', 'Withdrawal_Reversal',
];
const LEDGER_STATUSES = ['Success', 'Pending', 'Failed', 'Reversed'];

const REFUND_METHODS = ['Wallet', 'Original_Source', 'Bank_Transfer'];

const INR = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const INR2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtDateTime = (d) => d ? new Date(d).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—';

const STATUS_TONE = {
    // success / paid / delivered states
    Paid: 'success', Delivered: 'success', completed: 'success', paid: 'success',
    Completed: 'success', Success: 'success', Active: 'success', pay_at_service_paid: 'success',
    Approved: 'success', confirmed: 'success', Confirmed: 'success',
    // warning / pending states
    Pending: 'warning', pending: 'warning', payment_pending: 'warning', Placed: 'warning',
    Processing: 'warning', 'Out-for-Delivery': 'warning', partially_paid: 'warning',
    Partially_Refunded: 'warning', partially_refunded: 'warning', Return_Requested: 'warning',
    pay_at_service_pending: 'warning', pending_cash: 'warning', draft: 'warning', Trial: 'warning',
    in_progress: 'info', Pickup_Assigned: 'warning', Pickup_Done: 'warning',
    // error / failed / cancelled states
    Failed: 'error', failed: 'error', Cancelled: 'error', cancelled: 'error',
    no_show: 'error', Rejected: 'error', Return_Rejected: 'error', Reversed: 'error',
    unpaid: 'error',
    // neutral / refunded
    Refunded: 'info', refunded: 'info', refund_pending: 'info', Returned: 'info',
    waived: 'info', Return_Accepted: 'info',
};

const toneClass = {
    success: 'badge-success',
    warning: 'badge-warning',
    error: 'badge-error',
    info: 'badge-info',
    default: 'badge-secondary',
};

// ════════════════════════════════════════════════════════════════════════════
// SMALL UI HELPERS
// ════════════════════════════════════════════════════════════════════════════

function StatusBadge({ value }) {
    if (!value) return <span className="badge badge-secondary badge-sm">—</span>;
    const tone = STATUS_TONE[value] || 'default';
    return (
        <span className={`badge badge-sm ${toneClass[tone]}`}>
            {String(value).replace(/_/g, ' ')}
        </span>
    );
}

function formatLabel(str) {
    return String(str || '').replace(/_/g, ' ').replace(/-/g, ' ');
}

// ════════════════════════════════════════════════════════════════════════════
// KPI CARD
// ════════════════════════════════════════════════════════════════════════════

function KpiCard({ icon: Icon, label, value, sub, accent = 'primary', delay = 0 }) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, delay }}
            className="glass-card p-5 flex flex-col gap-3"
        >
            <div className="flex items-center justify-between">
                <div className={`flex items-center justify-center w-11 h-11 rounded-xl bg-${accent}/10`}>
                    <Icon className={`w-5 h-5 text-${accent}`} />
                </div>
            </div>
            <div>
                <p className="stat-card-label">{label}</p>
                <p className="stat-card-value !text-2xl md:!text-3xl mt-1">{value}</p>
                {sub && <p className="text-xs text-base-content/60 mt-1">{sub}</p>}
            </div>
        </motion.div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// PAGINATION BAR
// ════════════════════════════════════════════════════════════════════════════

function PaginationBar({ pagination, onPageChange, loading }) {
    const { page = 1, pages = 0, total = 0, limit = 20 } = pagination || {};
    if (!total) return null;

    const from = (page - 1) * limit + 1;
    const to = Math.min(page * limit, total);

    return (
        <div className="flex items-center justify-between flex-wrap gap-3 px-4 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/60">
                Showing <span className="font-semibold text-base-content">{from}–{to}</span> of{' '}
                <span className="font-semibold text-base-content">{total}</span>
            </p>
            <div className="flex items-center gap-2">
                <button
                    className="btn btn-ghost btn-sm btn-circle"
                    disabled={page <= 1 || loading}
                    onClick={() => onPageChange(page - 1)}
                    aria-label="Previous page"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs font-semibold px-2">
                    Page {page} of {pages || 1}
                </span>
                <button
                    className="btn btn-ghost btn-sm btn-circle"
                    disabled={page >= pages || loading}
                    onClick={() => onPageChange(page + 1)}
                    aria-label="Next page"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// FILTER BAR (generic)
// ════════════════════════════════════════════════════════════════════════════

function FilterBar({ children, searchValue, onSearchChange, searchPlaceholder, onReset, activeCount }) {
    const [open, setOpen] = useState(false);

    return (
        <div className="border-b border-base-300">
            <div className="flex items-center gap-3 p-4 flex-wrap">
                <div className="relative flex-1 min-w-[220px]">
                    <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                    <input
                        type="text"
                        value={searchValue}
                        onChange={(e) => onSearchChange(e.target.value)}
                        placeholder={searchPlaceholder}
                        className="input-field pl-9"
                    />
                </div>
                <button
                    onClick={() => setOpen((v) => !v)}
                    className={`btn btn-sm ${open ? 'btn-primary' : 'btn-outline'} gap-2`}
                >
                    <Filter className="w-3.5 h-3.5" />
                    Filters
                    {activeCount > 0 && (
                        <span className="badge badge-xs bg-primary-content/20 text-primary-content border-0">{activeCount}</span>
                    )}
                    <ChevronDown className={`w-3.5 h-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
                {activeCount > 0 && (
                    <button onClick={onReset} className="btn btn-ghost btn-sm gap-1.5 text-error">
                        <X className="w-3.5 h-3.5" /> Clear
                    </button>
                )}
            </div>
            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                            {children}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

function FilterField({ label, children }) {
    return (
        <div className="flex flex-col gap-1">
            <label className="label-text-alt font-semibold uppercase tracking-wide">{label}</label>
            {children}
        </div>
    );
}

function SelectInput({ value, onChange, options, placeholder = 'All' }) {
    return (
        <select value={value} onChange={(e) => onChange(e.target.value)} className="input-field">
            <option value="">{placeholder}</option>
            {options.map((opt) => (
                <option key={opt} value={opt}>{formatLabel(opt)}</option>
            ))}
        </select>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// REVENUE ANALYTICS HOOK (custom — hits /superadmin/analytics/revenue)
// ════════════════════════════════════════════════════════════════════════════

function useRevenueAnalytics(range) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchData = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const params = {};
            if (range?.startDate) params.startDate = range.startDate;
            if (range?.endDate) params.endDate = range.endDate;
            const res = await API.get('/superadmin/analytics/revenue', { params });
            setData(res.data);
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load revenue analytics');
        } finally {
            setLoading(false);
        }
    }, [range?.startDate, range?.endDate]);

    useEffect(() => { fetchData(); }, [fetchData]);

    return { data, loading, error, refetch: fetchData };
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION: OVERVIEW (KPIs + Charts)
// ════════════════════════════════════════════════════════════════════════════

function OverviewSection() {
    const { data: revenue, loading: revLoading, refetch: refetchRevenue } = useRevenueAnalytics();
    const billing = useSelector(selectBillingAnalytics);
    const dispatch = useDispatch();

    useEffect(() => {
        dispatch(fetchBillingSummary());
    }, [dispatch]);

    const grandTotal = revenue?.revenue?.grandTotal ?? 0;
    const pharmacy = revenue?.revenue?.pharmacy ?? { total: 0, count: 0, avgOrder: 0 };
    const bookings = revenue?.revenue?.bookings ?? { total: 0, count: 0, avgOrder: 0 };
    const subscription = revenue?.revenue?.subscription ?? { total: 0, count: 0 };

    const revenueShareData = useMemo(() => ([
        { name: 'Pharmacy', value: pharmacy.total },
        { name: 'Bookings', value: bookings.total },
        { name: 'Subscriptions', value: subscription.total },
    ].filter((d) => d.value > 0)), [pharmacy.total, bookings.total, subscription.total]);

    const timelineData = useMemo(() => {
        const arr = billing?.revenueTimeline || [];
        return arr.map((item) => ({
            label: `${MONTH_LABELS[(item.month - 1 + 12) % 12]} ${String(item.year).slice(-2)}`,
            revenue: item.revenue,
            count: item.count,
        }));
    }, [billing?.revenueTimeline]);

    const planBreakdown = billing?.planBreakdown || [];
    const upcomingRenewals = billing?.upcomingRenewals || [];

    return (
        <div className="flex flex-col gap-6">
            {/* ── KPI ROW ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <KpiCard
                    icon={IndianRupee}
                    label="Total Revenue (30d)"
                    value={revLoading ? '…' : INR.format(grandTotal)}
                    sub="Pharmacy + bookings + subscriptions"
                    accent="primary"
                    delay={0}
                />
                <KpiCard
                    icon={Package}
                    label="Pharmacy Revenue"
                    value={revLoading ? '…' : INR.format(pharmacy.total)}
                    sub={`${pharmacy.count} paid order${pharmacy.count === 1 ? '' : 's'} · avg ${INR.format(pharmacy.avgOrder || 0)}`}
                    accent="success"
                    delay={0.05}
                />
                <KpiCard
                    icon={Stethoscope}
                    label="Booking Revenue"
                    value={revLoading ? '…' : INR.format(bookings.total)}
                    sub={`${bookings.count} paid booking${bookings.count === 1 ? '' : 's'} · avg ${INR.format(bookings.avgOrder || 0)}`}
                    accent="info"
                    delay={0.1}
                />
                <KpiCard
                    icon={CreditCard}
                    label="Subscription Revenue"
                    value={revLoading ? '…' : INR.format(subscription.total)}
                    sub={`${subscription.count} payment${subscription.count === 1 ? '' : 's'} recorded`}
                    accent="accent"
                    delay={0.15}
                />
            </div>

            {/* ── CHARTS ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Revenue timeline */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.1 }}
                    className="card p-5 lg:col-span-2"
                >
                    <div className="flex items-center justify-between mb-4">
                        <div>
                            <h3 className="text-base font-bold text-base-content">Subscription Revenue Trend</h3>
                            <p className="text-xs text-base-content/50">Last 12 months</p>
                        </div>
                        <TrendingUp className="w-5 h-5 text-success" />
                    </div>
                    {timelineData.length === 0 ? (
                        <EmptyState compact icon={TrendingUp} title="No revenue data yet" />
                    ) : (
                        <ResponsiveContainer width="100%" height={260}>
                            <AreaChart data={timelineData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--color-primary)" stopOpacity={0.35} />
                                        <stop offset="100%" stopColor="var(--color-primary)" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                                <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--base-content)' }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fontSize: 11, fill: 'var(--base-content)' }} axisLine={false} tickLine={false}
                                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                                <Tooltip
                                    contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', fontSize: 12 }}
                                    formatter={(value, name) => name === 'revenue' ? [INR.format(value), 'Revenue'] : [value, 'Payments']}
                                />
                                <Area type="monotone" dataKey="revenue" stroke="var(--color-primary)" strokeWidth={2.5} fill="url(#revFill)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>

                {/* Revenue share pie */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.15 }}
                    className="card p-5"
                >
                    <h3 className="text-base font-bold text-base-content mb-1">Revenue Mix</h3>
                    <p className="text-xs text-base-content/50 mb-4">By source (30d window)</p>
                    {revenueShareData.length === 0 ? (
                        <EmptyState compact icon={IndianRupee} title="No revenue recorded" />
                    ) : (
                        <ResponsiveContainer width="100%" height={220}>
                            <PieChart>
                                <Pie
                                    data={revenueShareData}
                                    dataKey="value"
                                    nameKey="name"
                                    innerRadius={55}
                                    outerRadius={85}
                                    paddingAngle={3}
                                >
                                    {revenueShareData.map((_, i) => (
                                        <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} stroke="none" />
                                    ))}
                                </Pie>
                                <Tooltip
                                    contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', fontSize: 12 }}
                                    formatter={(value) => INR.format(value)}
                                />
                                <Legend wrapperStyle={{ fontSize: 11 }} />
                            </PieChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>
            </div>

            {/* ── SUBSCRIPTIONS ROW ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Status summary */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.2 }}
                    className="card p-5"
                >
                    <h3 className="text-base font-bold text-base-content mb-4">Subscriptions by Status</h3>
                    {(!billing?.summary || billing.summary.length === 0) ? (
                        <EmptyState compact icon={CreditCard} title="No subscriptions" />
                    ) : (
                        <div className="flex flex-col gap-3">
                            {billing.summary.map((s) => (
                                <div key={s._id} className="flex items-center justify-between">
                                    <StatusBadge value={s._id} />
                                    <div className="text-right">
                                        <p className="text-sm font-bold text-base-content">{s.count}</p>
                                        <p className="text-xs text-base-content/50">{INR.format(s.totalRevenue)}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>

                {/* Plan breakdown */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.25 }}
                    className="card p-5"
                >
                    <h3 className="text-base font-bold text-base-content mb-4">Active Plans</h3>
                    {planBreakdown.length === 0 ? (
                        <EmptyState compact icon={Users} title="No active plans" />
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={planBreakdown} layout="vertical" margin={{ left: 0, right: 16 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" horizontal={false} />
                                <XAxis type="number" tick={{ fontSize: 11, fill: 'var(--base-content)' }} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis type="category" dataKey="planName" width={90} tick={{ fontSize: 11, fill: 'var(--base-content)' }} axisLine={false} tickLine={false} />
                                <Tooltip contentStyle={{ background: 'var(--base-100)', border: '1px solid var(--base-300)', borderRadius: 'var(--r-field)', fontSize: 12 }} />
                                <Bar dataKey="count" radius={[0, 6, 6, 0]} fill="var(--color-primary)" />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </motion.div>

                {/* Upcoming renewals */}
                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.35, delay: 0.3 }}
                    className="card p-5"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-base-content">Renewals — Next 7 Days</h3>
                        <Clock className="w-4 h-4 text-warning" />
                    </div>
                    {upcomingRenewals.length === 0 ? (
                        <EmptyState compact icon={Clock} title="No upcoming renewals" />
                    ) : (
                        <div className="flex flex-col gap-2.5 max-h-[200px] overflow-y-auto scrollbar-thin pr-1">
                            {upcomingRenewals.map((sub) => (
                                <div key={sub._id} className="flex items-center justify-between text-sm">
                                    <div className="min-w-0">
                                        <p className="font-semibold text-base-content truncate">{sub.user?.name || 'Unknown'}</p>
                                        <p className="text-xs text-base-content/50">{sub.plan?.name || sub.planName}</p>
                                    </div>
                                    <span className="text-xs font-semibold text-warning whitespace-nowrap ml-2">{fmtDate(sub.expiryDate)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// EMPTY / LOADING STATES
// ════════════════════════════════════════════════════════════════════════════

function EmptyState({ icon: Icon = Receipt, title = 'Nothing here yet', sub, compact = false }) {
    return (
        <div className={`flex flex-col items-center justify-center text-center ${compact ? 'py-8' : 'py-16'}`}>
            <div className="w-12 h-12 rounded-2xl bg-base-300/60 flex items-center justify-center mb-3">
                <Icon className="w-5 h-5 text-base-content/40" />
            </div>
            <p className="text-sm font-semibold text-base-content/70">{title}</p>
            {sub && <p className="text-xs text-base-content/45 mt-1 max-w-xs">{sub}</p>}
        </div>
    );
}

function TableSkeleton({ rows = 6, cols = 6 }) {
    return (
        <div className="p-4 flex flex-col gap-3">
            {Array.from({ length: rows }).map((_, r) => (
                <div key={r} className="flex gap-4">
                    {Array.from({ length: cols }).map((_, c) => (
                        <div key={c} className="skeleton h-4 flex-1 rounded" />
                    ))}
                </div>
            ))}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// REFUND MODAL
// ════════════════════════════════════════════════════════════════════════════

function RefundModal({ open, onClose, target, kind }) {
    const dispatch = useDispatch();
    const { processing, error } = useSelector(selectRefundState);
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [method, setMethod] = useState('Wallet');

    const maxRefundable = useMemo(() => {
        if (!target) return 0;
        if (kind === 'pharmacy') return target.billing?.totalPayable ?? 0;
        return target.fareBreakdown?.amountPaid ?? 0;
    }, [target, kind]);

    useEffect(() => {
        if (open) {
            setAmount(maxRefundable ? String(maxRefundable) : '');
            setReason('');
            setMethod('Wallet');
            dispatch(resetRefundStatus());
        }
    }, [open, maxRefundable, dispatch]);

    if (!target) return null;

    const handleSubmit = async () => {
        const amt = Number(amount);
        if (!amt || amt <= 0) return toast.error('Enter a valid refund amount');
        if (amt > maxRefundable) return toast.error(`Amount exceeds refundable total of ${INR.format(maxRefundable)}`);
        if (!reason.trim()) return toast.error('Reason is required');

        const refundData = { amount: amt, reason: reason.trim(), method };

        let result;
        if (kind === 'pharmacy') {
            result = await dispatch(processPharmacyRefund({ orderId: target.orderId, refundData }));
        } else {
            result = await dispatch(processBookingRefund({ bookingId: target.bookingCode, refundData }));
        }

        if (!result.error) {
            onClose();
        }
    };

    const identifier = kind === 'pharmacy' ? target.orderId : target.bookingCode;
    const alreadyRefunded = kind === 'pharmacy'
        ? target.cancellation?.refundStatus === 'Processed'
        : target.paymentStatus === 'refunded';

    return (
        <AnimatePresence>
            {open && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
                    onClick={onClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 12 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 12 }}
                        transition={{ duration: 0.2 }}
                        onClick={(e) => e.stopPropagation()}
                        className="card bg-base-100 w-full max-w-md p-6 shadow-depth-lg"
                    >
                        <div className="flex items-start justify-between mb-1">
                            <div>
                                <h3 className="text-lg font-bold text-base-content">Process Refund</h3>
                                <p className="text-xs text-base-content/50 mt-0.5">
                                    {kind === 'pharmacy' ? 'Pharmacy order' : 'Booking'} <span className="font-mono font-semibold">{identifier}</span>
                                </p>
                            </div>
                            <button onClick={onClose} className="btn btn-ghost btn-circle btn-sm">
                                <X className="w-4 h-4" />
                            </button>
                        </div>

                        {alreadyRefunded ? (
                            <div className="alert alert-warning mt-4">
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                <p className="text-sm">This {kind === 'pharmacy' ? 'order' : 'booking'} has already been refunded.</p>
                            </div>
                        ) : (
                            <div className="flex flex-col gap-4 mt-4">
                                <div>
                                    <label className="label-text mb-1.5 block">Refund Amount</label>
                                    <div className="relative">
                                        <IndianRupee className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                                        <input
                                            type="number"
                                            min="1"
                                            max={maxRefundable}
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="input-field pl-9"
                                        />
                                    </div>
                                    <p className="label-text-alt mt-1">Max refundable: {INR2.format(maxRefundable)}</p>
                                </div>

                                <div>
                                    <label className="label-text mb-1.5 block">Refund Method</label>
                                    <div className="grid grid-cols-3 gap-2">
                                        {REFUND_METHODS.map((m) => (
                                            <button
                                                key={m}
                                                onClick={() => setMethod(m)}
                                                className={`btn btn-sm ${method === m ? 'btn-primary' : 'btn-outline'}`}
                                            >
                                                {formatLabel(m)}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="label-text mb-1.5 block">Reason (required)</label>
                                    <textarea
                                        value={reason}
                                        onChange={(e) => setReason(e.target.value)}
                                        rows={3}
                                        placeholder="Explain why this refund is being issued…"
                                        className="input-field resize-none"
                                    />
                                </div>

                                {error && (
                                    <div className="alert alert-error">
                                        <XCircle className="w-4 h-4 shrink-0" />
                                        <p className="text-sm">{error}</p>
                                    </div>
                                )}

                                <div className="flex gap-2 justify-end pt-2">
                                    <button onClick={onClose} className="btn btn-ghost" disabled={processing}>Cancel</button>
                                    <button onClick={handleSubmit} className="btn btn-error gap-2" disabled={processing}>
                                        {processing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Banknote className="w-4 h-4" />}
                                        Confirm Refund
                                    </button>
                                </div>
                            </div>
                        )}
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION: PHARMACY ORDERS
// ════════════════════════════════════════════════════════════════════════════

function PharmacyOrdersSection() {
    const dispatch = useDispatch();
    const { data, pagination, loading } = useSelector(selectPharmacyOrders);

    const [filters, setFilters] = useState({
        search: '', deliveryStatus: '', paymentStatus: '', paymentMethod: '',
        startDate: '', endDate: '', minAmount: '', maxAmount: '',
    });
    const [page, setPage] = useState(1);
    const [refundTarget, setRefundTarget] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const activeCount = useMemo(
        () => Object.values(filters).filter((v) => v && v !== filters.search).length
            + (filters.search ? 1 : 0) - (filters.search ? 1 : 0) // search counted separately below
            + Object.entries(filters).filter(([k, v]) => k !== 'search' && v).length - Object.entries(filters).filter(([k, v]) => k !== 'search' && v).length,
        [filters]
    );
    const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v).length;

    useEffect(() => {
        const params = { page, limit: 20 };
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
        const timer = setTimeout(() => dispatch(fetchPharmacyOrders(params)), filters.search ? 350 : 0);
        return () => clearTimeout(timer);
    }, [dispatch, page, filters]);

    const updateFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
    const resetFilters = () => { setFilters({ search: '', deliveryStatus: '', paymentStatus: '', paymentMethod: '', startDate: '', endDate: '', minAmount: '', maxAmount: '' }); setPage(1); };

    return (
        <>
            <div className="card overflow-hidden">
                <FilterBar
                    searchValue={filters.search}
                    onSearchChange={(v) => updateFilter('search', v)}
                    searchPlaceholder="Search by order ID (ORD-XXXX-…)"
                    onReset={resetFilters}
                    activeCount={activeFilterCount}
                >
                    <FilterField label="Delivery Status">
                        <SelectInput value={filters.deliveryStatus} onChange={(v) => updateFilter('deliveryStatus', v)} options={PHARMACY_DELIVERY_STATUSES} />
                    </FilterField>
                    <FilterField label="Payment Status">
                        <SelectInput value={filters.paymentStatus} onChange={(v) => updateFilter('paymentStatus', v)} options={PHARMACY_PAYMENT_STATUSES} />
                    </FilterField>
                    <FilterField label="Payment Method">
                        <SelectInput value={filters.paymentMethod} onChange={(v) => updateFilter('paymentMethod', v)} options={PAYMENT_METHODS_PHARMACY} />
                    </FilterField>
                    <FilterField label="From Date">
                        <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className="input-field" />
                    </FilterField>
                    <FilterField label="To Date">
                        <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className="input-field" />
                    </FilterField>
                    <FilterField label="Min Amount (₹)">
                        <input type="number" value={filters.minAmount} onChange={(e) => updateFilter('minAmount', e.target.value)} className="input-field" placeholder="0" />
                    </FilterField>
                    <FilterField label="Max Amount (₹)">
                        <input type="number" value={filters.maxAmount} onChange={(e) => updateFilter('maxAmount', e.target.value)} className="input-field" placeholder="No limit" />
                    </FilterField>
                </FilterBar>

                {loading ? (
                    <TableSkeleton />
                ) : data.length === 0 ? (
                    <EmptyState icon={Package} title="No pharmacy orders found" sub="Try adjusting filters or search terms." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Order</th>
                                    <th>Customer</th>
                                    <th>Store</th>
                                    <th>Items</th>
                                    <th>Total</th>
                                    <th>Payment</th>
                                    <th>Delivery</th>
                                    <th>Placed</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((order) => (
                                    <PharmacyRow
                                        key={order._id}
                                        order={order}
                                        expanded={expandedId === order._id}
                                        onToggle={() => setExpandedId(expandedId === order._id ? null : order._id)}
                                        onRefund={() => setRefundTarget(order)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <PaginationBar pagination={pagination} onPageChange={setPage} loading={loading} />
            </div>

            <RefundModal open={!!refundTarget} onClose={() => setRefundTarget(null)} target={refundTarget} kind="pharmacy" />
        </>
    );
}

function PharmacyRow({ order, expanded, onToggle, onRefund }) {
    const canRefund = order.payment?.status === 'Paid' && order.cancellation?.refundStatus !== 'Processed';

    return (
        <>
            <tr className="cursor-pointer" onClick={onToggle}>
                <td>
                    <div className="flex items-center gap-2">
                        <ChevronDown className={`w-3.5 h-3.5 text-base-content/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <span className="font-mono text-xs font-semibold">{order.orderId}</span>
                    </div>
                </td>
                <td>
                    <p className="font-semibold text-sm">{order.customer?.name || '—'}</p>
                    <p className="text-xs text-base-content/50">{order.customer?.phone || order.customer?.email || ''}</p>
                </td>
                <td className="text-sm">{order.store?.storeName || '—'}</td>
                <td className="text-sm">{order.items?.length ?? 0} item{(order.items?.length ?? 0) === 1 ? '' : 's'}</td>
                <td className="font-semibold text-sm">{INR2.format(order.billing?.totalPayable ?? 0)}</td>
                <td>
                    <div className="flex flex-col gap-1 items-start">
                        <StatusBadge value={order.payment?.status} />
                        <span className="text-xs text-base-content/50">{formatLabel(order.payment?.method)}</span>
                    </div>
                </td>
                <td><StatusBadge value={order.delivery?.status} /></td>
                <td className="text-xs text-base-content/60 whitespace-nowrap">{fmtDate(order.createdAt)}</td>
                <td className="text-right">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRefund(); }}
                        disabled={!canRefund}
                        className="btn btn-xs btn-outline gap-1.5"
                        title={canRefund ? 'Process refund' : 'Refund unavailable'}
                    >
                        <RefreshCw className="w-3 h-3" /> Refund
                    </button>
                </td>
            </tr>
            <AnimatePresence>
                {expanded && (
                    <tr>
                        <td colSpan={9} className="p-0 border-b border-base-300">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-base-200 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    {/* Items */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Items</h4>
                                        <div className="flex flex-col gap-2">
                                            {(order.items || []).map((item, i) => (
                                                <div key={i} className="flex justify-between text-sm bg-base-100 rounded-lg px-3 py-2">
                                                    <div className="min-w-0">
                                                        <p className="font-semibold truncate">{item.name}</p>
                                                        <p className="text-xs text-base-content/50">{item.brandName} · Qty {item.quantity} · GST {item.gstPercentage}%</p>
                                                    </div>
                                                    <p className="font-semibold whitespace-nowrap ml-2">{INR2.format(item.totalPrice)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Billing breakdown */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Billing</h4>
                                        <div className="flex flex-col gap-1.5 text-sm bg-base-100 rounded-lg p-3">
                                            <BillRow label="Subtotal" value={order.billing?.subTotal} />
                                            <BillRow label="GST" value={order.billing?.gstAmount} />
                                            <BillRow label="Delivery Charges" value={order.billing?.deliveryCharges} />
                                            <BillRow label="Platform Fee" value={order.billing?.platformFee} />
                                            <BillRow label="Discount" value={order.billing?.discountAmount} negative />
                                            <BillRow label="Wallet Used" value={order.billing?.walletAmountUsed} negative />
                                            <div className="divider my-1" />
                                            <BillRow label="Total Payable" value={order.billing?.totalPayable} bold />
                                            {order.billing?.promoCode && (
                                                <p className="text-xs text-base-content/50 mt-1">Promo: <span className="font-mono">{order.billing.promoCode}</span></p>
                                            )}
                                        </div>
                                    </div>

                                    {/* Delivery / refund info */}
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Delivery &amp; Refund</h4>
                                        <div className="flex flex-col gap-1.5 text-sm bg-base-100 rounded-lg p-3">
                                            <BillRow label="Address" value={[order.delivery?.address?.line1, order.delivery?.address?.city, order.delivery?.address?.pincode].filter(Boolean).join(', ') || '—'} text />
                                            <BillRow label="Delivery Type" value={formatLabel(order.delivery?.deliveryType)} text />
                                            {order.delivery?.deliveredAt && <BillRow label="Delivered At" value={fmtDateTime(order.delivery.deliveredAt)} text />}
                                            {order.cancellation?.refundStatus && order.cancellation.refundStatus !== 'None' && (
                                                <>
                                                    <div className="divider my-1" />
                                                    <BillRow label="Refund Status" value={<StatusBadge value={order.cancellation.refundStatus} />} text />
                                                    {order.cancellation?.refundAmount > 0 && <BillRow label="Refund Amount" value={INR2.format(order.cancellation.refundAmount)} text />}
                                                    {order.cancellation?.refundMethod && <BillRow label="Refund Method" value={formatLabel(order.cancellation.refundMethod)} text />}
                                                    {order.cancellation?.refundedAt && <BillRow label="Refunded At" value={fmtDateTime(order.cancellation.refundedAt)} text />}
                                                </>
                                            )}
                                            {order.prescription?.verificationStatus && order.prescription.verificationStatus !== 'Not_Uploaded' && (
                                                <>
                                                    <div className="divider my-1" />
                                                    <BillRow label="Prescription" value={<StatusBadge value={order.prescription.verificationStatus} />} text />
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
}

function BillRow({ label, value, bold, negative, text }) {
    return (
        <div className="flex justify-between items-center gap-2">
            <span className={`text-base-content/60 ${bold ? 'font-bold text-base-content' : ''}`}>{label}</span>
            {text ? (
                <span className={`text-right ${bold ? 'font-bold text-base-content' : 'text-base-content/80'}`}>{value}</span>
            ) : (
                <span className={`${bold ? 'font-bold text-base-content' : ''} ${negative && value > 0 ? 'text-error' : ''}`}>
                    {negative && value > 0 ? '−' : ''}{INR2.format(value ?? 0)}
                </span>
            )}
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION: HEALTHCARE BOOKINGS
// ════════════════════════════════════════════════════════════════════════════

function BookingsSection() {
    const [data, setData] = useState([]);
    const [pagination, setPagination] = useState({});
    const [loading, setLoading] = useState(true);
    const [filters, setFilters] = useState({
        search: '', status: '', paymentStatus: '', bookingType: '', startDate: '', endDate: '',
    });
    const [page, setPage] = useState(1);
    const [refundTarget, setRefundTarget] = useState(null);
    const [expandedId, setExpandedId] = useState(null);

    const activeFilterCount = Object.entries(filters).filter(([k, v]) => k !== 'search' && v).length;

    const fetchBookings = useCallback(async () => {
        setLoading(true);
        try {
            const params = { page, limit: 20 };
            Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
            const res = await API.get('/superadmin/bookings', { params });
            setData(res.data.data || []);
            setPagination(res.data.pagination || {});
        } catch (err) {
            toast.error(err.response?.data?.message || 'Failed to fetch bookings');
        } finally {
            setLoading(false);
        }
    }, [page, filters]);

    useEffect(() => {
        const timer = setTimeout(fetchBookings, filters.search ? 350 : 0);
        return () => clearTimeout(timer);
    }, [fetchBookings, filters.search]); // eslint-disable-line react-hooks/exhaustive-deps

    useEffect(() => { fetchBookings(); }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

    const updateFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
    const resetFilters = () => { setFilters({ search: '', status: '', paymentStatus: '', bookingType: '', startDate: '', endDate: '' }); setPage(1); };

    const handleRefundClose = () => { setRefundTarget(null); fetchBookings(); };

    return (
        <>
            <div className="card overflow-hidden">
                <FilterBar
                    searchValue={filters.search}
                    onSearchChange={(v) => updateFilter('search', v)}
                    searchPlaceholder="Search by booking code (BK-XXXXXXXX)"
                    onReset={resetFilters}
                    activeCount={activeFilterCount}
                >
                    <FilterField label="Booking Status">
                        <SelectInput value={filters.status} onChange={(v) => updateFilter('status', v)} options={BOOKING_STATUSES} />
                    </FilterField>
                    <FilterField label="Payment Status">
                        <SelectInput value={filters.paymentStatus} onChange={(v) => updateFilter('paymentStatus', v)} options={BOOKING_PAYMENT_STATUSES} />
                    </FilterField>
                    <FilterField label="Booking Type">
                        <SelectInput value={filters.bookingType} onChange={(v) => updateFilter('bookingType', v)} options={BOOKING_TYPES} />
                    </FilterField>
                    <FilterField label="From Date">
                        <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className="input-field" />
                    </FilterField>
                    <FilterField label="To Date">
                        <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className="input-field" />
                    </FilterField>
                </FilterBar>

                {loading ? (
                    <TableSkeleton />
                ) : data.length === 0 ? (
                    <EmptyState icon={Stethoscope} title="No bookings found" sub="Try adjusting filters or search terms." />
                ) : (
                    <div className="overflow-x-auto">
                        <table className="table">
                            <thead>
                                <tr>
                                    <th>Booking</th>
                                    <th>Customer</th>
                                    <th>Type</th>
                                    <th>Provider</th>
                                    <th>Scheduled</th>
                                    <th>Amount Paid</th>
                                    <th>Payment</th>
                                    <th>Status</th>
                                    <th className="text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data.map((booking) => (
                                    <BookingRow
                                        key={booking._id}
                                        booking={booking}
                                        expanded={expandedId === booking._id}
                                        onToggle={() => setExpandedId(expandedId === booking._id ? null : booking._id)}
                                        onRefund={() => setRefundTarget(booking)}
                                    />
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                <PaginationBar pagination={pagination} onPageChange={setPage} loading={loading} />
            </div>

            <RefundModal open={!!refundTarget} onClose={handleRefundClose} target={refundTarget} kind="booking" />
        </>
    );
}

function BookingRow({ booking, expanded, onToggle, onRefund }) {
    const canRefund = ['paid', 'partially_paid', 'pay_at_service_paid'].includes(booking.paymentStatus)
        && booking.paymentStatus !== 'refunded';

    const provider = booking.doctor?.specialization
        ? `Dr. · ${booking.doctor.specialization}`
        : booking.careAssistant?.fullName
            ? booking.careAssistant.fullName
            : booking.hospital?.name
                ? booking.hospital.name
                : booking.labPartner?.name || '—';

    return (
        <>
            <tr className="cursor-pointer" onClick={onToggle}>
                <td>
                    <div className="flex items-center gap-2">
                        <ChevronDown className={`w-3.5 h-3.5 text-base-content/40 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                        <span className="font-mono text-xs font-semibold">{booking.bookingCode}</span>
                    </div>
                </td>
                <td>
                    <p className="font-semibold text-sm">{booking.customer?.name || '—'}</p>
                    <p className="text-xs text-base-content/50">{booking.customer?.phone || ''}</p>
                </td>
                <td><span className="badge badge-sm badge-secondary">{formatLabel(booking.bookingType)}</span></td>
                <td className="text-sm">{provider}</td>
                <td className="text-xs text-base-content/60 whitespace-nowrap">{fmtDateTime(booking.scheduledAt)}</td>
                <td className="font-semibold text-sm">{INR2.format(booking.fareBreakdown?.amountPaid ?? 0)}</td>
                <td><StatusBadge value={booking.paymentStatus} /></td>
                <td><StatusBadge value={booking.status} /></td>
                <td className="text-right">
                    <button
                        onClick={(e) => { e.stopPropagation(); onRefund(); }}
                        disabled={!canRefund}
                        className="btn btn-xs btn-outline gap-1.5"
                        title={canRefund ? 'Process refund' : 'Refund unavailable'}
                    >
                        <RefreshCw className="w-3 h-3" /> Refund
                    </button>
                </td>
            </tr>
            <AnimatePresence>
                {expanded && (
                    <tr>
                        <td colSpan={9} className="p-0 border-b border-base-300">
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                                className="overflow-hidden"
                            >
                                <div className="bg-base-200 p-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Fare Breakdown</h4>
                                        <div className="flex flex-col gap-1.5 text-sm bg-base-100 rounded-lg p-3">
                                            <BillRow label="Consultation Fee" value={booking.fareBreakdown?.consultationFee} />
                                            <BillRow label="Care Assistant Fee" value={booking.fareBreakdown?.careAssistantFee} />
                                            <BillRow label="Transport Fee" value={booking.fareBreakdown?.transportFee} />
                                            <BillRow label="Diagnostic Fee" value={booking.fareBreakdown?.diagnosticFee} />
                                            <BillRow label="Home Collection Fee" value={booking.fareBreakdown?.homeCollectionFee} />
                                            <BillRow label="Platform Fee" value={booking.fareBreakdown?.platformFee} />
                                            <BillRow label="Taxes" value={booking.fareBreakdown?.taxes} />
                                            <BillRow label="Discount" value={booking.fareBreakdown?.discount} negative />
                                            <BillRow label="Coupon Discount" value={booking.fareBreakdown?.couponDiscount} negative />
                                            <BillRow label="Wallet Applied" value={booking.fareBreakdown?.walletApplied} negative />
                                            <div className="divider my-1" />
                                            <BillRow label="Total Amount" value={booking.fareBreakdown?.totalAmount} bold />
                                            <BillRow label="Amount Paid" value={booking.fareBreakdown?.amountPaid} bold />
                                            {booking.fareBreakdown?.refundAmount > 0 && (
                                                <BillRow label="Refund Amount" value={booking.fareBreakdown.refundAmount} />
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Patient &amp; Schedule</h4>
                                        <div className="flex flex-col gap-1.5 text-sm bg-base-100 rounded-lg p-3">
                                            <BillRow label="Patient" value={booking.patientInfo?.name || '—'} text />
                                            <BillRow label="Age / Gender" value={`${booking.patientInfo?.age ?? '—'} / ${booking.patientInfo?.gender || '—'}`} text />
                                            <BillRow label="Consultation Type" value={formatLabel(booking.consultationType) || '—'} text />
                                            <BillRow label="Scheduled At" value={fmtDateTime(booking.scheduledAt)} text />
                                            {booking.completedAt && <BillRow label="Completed At" value={fmtDateTime(booking.completedAt)} text />}
                                            {booking.diagnosticDetails?.testNames?.length > 0 && (
                                                <BillRow label="Tests" value={booking.diagnosticDetails.testNames.join(', ')} text />
                                            )}
                                        </div>
                                    </div>

                                    <div>
                                        <h4 className="text-xs font-bold uppercase tracking-wide text-base-content/50 mb-2">Payments &amp; Cancellation</h4>
                                        <div className="flex flex-col gap-1.5 text-sm bg-base-100 rounded-lg p-3">
                                            {(booking.payments || []).length === 0 ? (
                                                <p className="text-base-content/50 text-xs">No payment records</p>
                                            ) : (
                                                booking.payments.map((p, i) => (
                                                    <div key={i} className="flex justify-between items-center">
                                                        <div className="min-w-0">
                                                            <p className="font-semibold text-xs">{formatLabel(p.gateway)} · {formatLabel(p.paymentMode)}</p>
                                                            <p className="text-xs text-base-content/50">{fmtDateTime(p.paidAt)}</p>
                                                        </div>
                                                        <div className="text-right">
                                                            <p className="font-semibold text-xs">{INR2.format(p.amount)}</p>
                                                            <StatusBadge value={p.status} />
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            {booking.cancellation && (
                                                <>
                                                    <div className="divider my-1" />
                                                    <BillRow label="Cancelled By" value={formatLabel(booking.cancellation.cancelledBy)} text />
                                                    <BillRow label="Reason" value={booking.cancellation.reason || '—'} text />
                                                    {booking.cancellation.cancelledAt && <BillRow label="Cancelled At" value={fmtDateTime(booking.cancellation.cancelledAt)} text />}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </td>
                    </tr>
                )}
            </AnimatePresence>
        </>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// SECTION: WALLET LEDGER
// ════════════════════════════════════════════════════════════════════════════

function LedgerSection() {
    const dispatch = useDispatch();
    const { data, pagination, loading } = useSelector(selectFinancialLedger);

    const [filters, setFilters] = useState({ type: '', purpose: '', status: '', startDate: '', endDate: '' });
    const [page, setPage] = useState(1);

    const activeFilterCount = Object.values(filters).filter(Boolean).length;

    useEffect(() => {
        const params = { page, limit: 25 };
        Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
        dispatch(fetchFinancialLedger(params));
    }, [dispatch, page, filters]);

    const updateFilter = (key, value) => { setFilters((f) => ({ ...f, [key]: value })); setPage(1); };
    const resetFilters = () => { setFilters({ type: '', purpose: '', status: '', startDate: '', endDate: '' }); setPage(1); };

    const summary = useSelector((state) => state.superadmin?.financialLedger); // not used directly — kept for future

    return (
        <div className="card overflow-hidden">
            <FilterBar
                searchValue=""
                onSearchChange={() => {}}
                searchPlaceholder=""
                onReset={resetFilters}
                activeCount={activeFilterCount}
            >
                <FilterField label="Transaction Type">
                    <SelectInput value={filters.type} onChange={(v) => updateFilter('type', v)} options={LEDGER_TYPES} />
                </FilterField>
                <FilterField label="Purpose">
                    <SelectInput value={filters.purpose} onChange={(v) => updateFilter('purpose', v)} options={LEDGER_PURPOSES} />
                </FilterField>
                <FilterField label="Status">
                    <SelectInput value={filters.status} onChange={(v) => updateFilter('status', v)} options={LEDGER_STATUSES} />
                </FilterField>
                <FilterField label="From Date">
                    <input type="date" value={filters.startDate} onChange={(e) => updateFilter('startDate', e.target.value)} className="input-field" />
                </FilterField>
                <FilterField label="To Date">
                    <input type="date" value={filters.endDate} onChange={(e) => updateFilter('endDate', e.target.value)} className="input-field" />
                </FilterField>
            </FilterBar>

            {loading ? (
                <TableSkeleton />
            ) : data.length === 0 ? (
                <EmptyState icon={WalletIcon} title="No transactions found" sub="Try adjusting filters." />
            ) : (
                <div className="overflow-x-auto">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Transaction</th>
                                <th>User</th>
                                <th>Type</th>
                                <th>Purpose</th>
                                <th>Amount</th>
                                <th>Balance After</th>
                                <th>Status</th>
                                <th>Timestamp</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((row, idx) => {
                                const txn = row.transaction;
                                const isCredit = txn.type === 'Credit';
                                return (
                                    <tr key={txn._id || idx}>
                                        <td>
                                            <p className="font-mono text-xs font-semibold">{txn.transactionId}</p>
                                            {txn.description && <p className="text-xs text-base-content/50 max-w-[220px] truncate">{txn.description}</p>}
                                        </td>
                                        <td>
                                            <p className="font-semibold text-sm">{row.userId?.name || '—'}</p>
                                            <p className="text-xs text-base-content/50">{row.userId?.email || ''}</p>
                                        </td>
                                        <td>
                                            <span className={`badge badge-sm gap-1 ${isCredit ? 'badge-success' : 'badge-error'}`}>
                                                {isCredit ? <ArrowDownRight className="w-3 h-3" /> : <ArrowUpRight className="w-3 h-3" />}
                                                {txn.type}
                                            </span>
                                        </td>
                                        <td><span className="badge badge-sm badge-secondary">{formatLabel(txn.purpose)}</span></td>
                                        <td className={`font-semibold text-sm ${isCredit ? 'text-success' : 'text-error'}`}>
                                            {isCredit ? '+' : '−'}{INR2.format(txn.amount)}
                                        </td>
                                        <td className="text-sm">{INR2.format(txn.balanceAfter ?? 0)}</td>
                                        <td><StatusBadge value={txn.status} /></td>
                                        <td className="text-xs text-base-content/60 whitespace-nowrap">{fmtDateTime(txn.timestamp)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            )}

            <PaginationBar pagination={pagination} onPageChange={setPage} loading={loading} />
        </div>
    );
}

// ════════════════════════════════════════════════════════════════════════════
// MAIN PAGE
// ════════════════════════════════════════════════════════════════════════════

export default function PaymentOverviewPage() {
    const [activeTab, setActiveTab] = useState('pharmacy');

    return (
        <div className="container-custom py-6 md:py-8 flex flex-col gap-6" data-theme="superadmin">
            {/* ── Page Header ── */}
            <div className="flex items-start justify-between flex-wrap gap-4">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                            <ShieldCheck className="w-5 h-5 text-primary" />
                        </div>
                        <h1 className="text-2xl md:text-3xl font-extrabold text-base-content tracking-tight">Payment Overview</h1>
                    </div>
                    <p className="text-sm text-base-content/55 ml-12">
                        Revenue analytics, order payments, booking refunds, and wallet ledger — platform-wide.
                    </p>
                </div>
            </div>

            {/* ── Overview KPIs + Charts ── */}
            <OverviewSection />

            {/* ── Tabs ── */}
            <div className="card p-1.5 flex flex-row gap-1 w-full sm:w-fit overflow-x-auto scrollbar-thin">
                {TABS.map((tab) => {
                    const Icon = tab.icon;
                    const active = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-[var(--r-field)] text-sm font-semibold whitespace-nowrap transition-colors
                                ${active ? 'bg-primary text-primary-content shadow-primary' : 'text-base-content/60 hover:bg-base-200'}`}
                        >
                            <Icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                >
                    {activeTab === 'pharmacy' && <PharmacyOrdersSection />}
                    {activeTab === 'bookings' && <BookingsSection />}
                    {activeTab === 'ledger' && <LedgerSection />}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}