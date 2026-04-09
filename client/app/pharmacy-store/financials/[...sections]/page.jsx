"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  CalendarDays, FileBarChart, TrendingUp, History,
  ReceiptIndianRupee, Send, WalletCards, Building2,
  IndianRupee, CircleDollarSign, ArrowLeftRight,
  ChevronRight, AlertCircle, RefreshCw,
  ArrowUp, ArrowDown, Loader2, Download, Mail,
} from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend,
} from "recharts";

import {
  fetchDailyEarnings,
  fetchMonthlyEarnings,
  fetchTotalEarnings,
  fetchEarningsHistory,
  fetchStoreInvoice,
  sendStoreInvoice,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";

import {
  PaymentAccountSection,
  AddBankSection,
  AddUpiSection,
  SettlementsSection,
  RequestSettlementSection,
  SettlementHistorySection,
} from "./SettlementsPayments";

// ─── helpers ──────────────────────────────────────────────────────────────────
const fmt = (n) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n ?? 0);

const fmtShort = (n) => {
  if (!n) return "₹0";
  if (n >= 10_00_000) return `₹${(n / 10_00_000).toFixed(1)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
};

const fadeUp = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: { duration: 0.35 } } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };

// ─── nav config ───────────────────────────────────────────────────────────────
const FINANCIAL_LINKS = [
  { name: "Daily Financials",   href: "/pharmacy-store/financials/daily",              icon: CalendarDays,         section: "daily"        },
  { name: "Monthly Financials", href: "/pharmacy-store/financials/monthly",            icon: FileBarChart,         section: "monthly"      },
  { name: "Total Earnings",     href: "/pharmacy-store/financials/total",              icon: TrendingUp,           section: "total"        },
  { name: "Earnings History",   href: "/pharmacy-store/financials/history",            icon: History,              section: "history"      },
  { name: "Store Invoice",      href: "/pharmacy-store/financials/store-invoice",      icon: ReceiptIndianRupee,   section: "store-invoice"},
  { name: "Send Invoice",       href: "/pharmacy-store/financials/store-invoice/send", icon: Send,                 section: "send-invoice" },
];

const SETTLEMENT_LINKS = [
  { name: "Payment Account",      href: "/pharmacy-store/financials/payment-account",          icon: WalletCards,        section: "payment-account"     },
  { name: "Add Bank Account",     href: "/pharmacy-store/financials/payment-account/bank",     icon: Building2,          section: "bank"                },
  { name: "Add UPI Handle",       href: "/pharmacy-store/financials/payment-account/upi",      icon: IndianRupee,        section: "upi"                 },
  { name: "Settlements Overview", href: "/pharmacy-store/financials/settlements",              icon: CircleDollarSign,   section: "settlements"         },
  { name: "Request Settlement",   href: "/pharmacy-store/financials/settlements/request",      icon: ArrowLeftRight,     section: "settlements-request" },
  { name: "Settlement History",   href: "/pharmacy-store/financials/settlements/history",      icon: History,            section: "settlements-history" },
];

// ─── small reusables ──────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent = false, delta }) {
  const isPos = delta > 0;
  return (
    <motion.div variants={fadeUp}
      className={`rounded-xl p-5 border ${accent
        ? "bg-primary/5 border-primary/20"
        : "bg-base-100 border-base-300"} flex flex-col gap-1`}
    >
      <span className="text-xs font-semibold text-base-content/50 uppercase tracking-widest">{label}</span>
      <span className={`text-2xl font-black font-montserrat ${accent ? "text-primary" : "text-base-content"}`}>{value}</span>
      {sub && <span className="text-xs text-base-content/50">{sub}</span>}
      {delta !== undefined && (
        <span className={`text-xs font-semibold flex items-center gap-1 ${isPos ? "text-success" : "text-error"}`}>
          {isPos ? <ArrowUp size={12} /> : <ArrowDown size={12} />}
          {Math.abs(delta).toFixed(1)}%
        </span>
      )}
    </motion.div>
  );
}

function SectionLoading() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <Loader2 size={32} className="text-primary animate-spin" />
      <p className="text-base-content/50 text-sm">Loading data…</p>
    </div>
  );
}

function EmptyState({ message = "No data available" }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-3">
      <AlertCircle size={36} className="text-base-content/30" />
      <p className="text-base-content/40 text-sm">{message}</p>
    </div>
  );
}

// ─── CHART COLORS ─────────────────────────────────────────────────────────────
const CHART_COLORS = ["var(--color-primary)", "var(--color-secondary)", "var(--color-accent)", "var(--color-info)"];

// ─── SECTION RENDERERS ────────────────────────────────────────────────────────

// Daily
function DailySection() {
  const dispatch = useDispatch();
  const { dailyEarnings, loading } = useSelector((s) => s.pharmacyStore);

  useEffect(() => { dispatch(fetchDailyEarnings()); }, [dispatch]);

  if (loading.dailyEarnings) return <SectionLoading />;
  if (!dailyEarnings) return <EmptyState />;

  const d = dailyEarnings;
  const statusData = Object.entries(d.statusBreakdown || {}).map(([k, v]) => ({ name: k.replace(/_/g, " "), value: v }));

  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black font-montserrat text-base-content">{d.date}</h2>
          <p className="text-sm text-base-content/50 mt-0.5">Daily financial snapshot</p>
        </div>
        <button onClick={() => dispatch(fetchDailyEarnings())}
          className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors">
          <RefreshCw size={14} /> Refresh
        </button>
      </motion.div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue"  value={fmt(d.grossRevenue)}   accent />
        <StatCard label="Net Revenue"    value={fmt(d.netRevenue)} />
        <StatCard label="GST Collected"  value={fmt(d.gstCollected)} />
        <StatCard label="Total Orders"   value={d.totalOrders} sub={`${d.paidOrders} paid`} />
      </div>

      {statusData.length > 0 && (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-5">
          <h3 className="font-bold text-base-content mb-4 text-sm uppercase tracking-widest">Order Status Breakdown</h3>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={85} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {statusData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Legend />
                <Tooltip formatter={(v) => [v, "Orders"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {d.discounts > 0 && (
        <motion.div variants={fadeUp} className="bg-warning/5 border border-warning/20 rounded-xl p-4">
          <p className="text-sm text-base-content/70">Total discounts given today: <span className="font-bold text-warning">{fmt(d.discounts)}</span></p>
        </motion.div>
      )}
    </motion.div>
  );
}

// Monthly
function MonthlySection() {
  const dispatch = useDispatch();
  const { monthlyEarnings, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchMonthlyEarnings()); }, [dispatch]);
  if (loading.monthlyEarnings) return <SectionLoading />;
  if (!monthlyEarnings) return <EmptyState />;
  const d = monthlyEarnings;
  const chartData = (d.dailyBreakdown || []).map((row) => ({ day: row._id?.slice(8), rev: row.revenue, orders: row.orders }));
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">{d.month}</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Monthly earnings report</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue" value={fmt(d.grossRevenue)} accent />
        <StatCard label="Net Revenue"   value={fmt(d.netRevenue)} />
        <StatCard label="GST Collected" value={fmt(d.gstCollected)} />
        <StatCard label="Total Orders"  value={d.totalOrders} />
      </div>
      {chartData.length > 0 && (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content mb-4">Daily Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--color-primary)" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(v), "Revenue"]} />
                <Area type="monotone" dataKey="rev" stroke="var(--color-primary)" fill="url(#revGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// Total Earnings
function TotalSection() {
  const dispatch = useDispatch();
  const { totalEarnings, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchTotalEarnings()); }, [dispatch]);
  if (loading.totalEarnings) return <SectionLoading />;
  if (!totalEarnings) return <EmptyState />;
  const d = totalEarnings;
  const chartData = (d.monthlyTrend || []).map((m) => ({ month: m._id, rev: m.revenue, orders: m.orders }));
  const topMeds = d.topMedicines || [];
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Lifetime Earnings</h2>
        <p className="text-sm text-base-content/50 mt-0.5">All-time financial performance</p>
      </motion.div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Gross Revenue"   value={fmt(d.grossRevenue)} accent />
        <StatCard label="Net Revenue"     value={fmt(d.netRevenue)} />
        <StatCard label="GST Collected"   value={fmt(d.gstCollected)} />
        <StatCard label="Total Orders"    value={d.totalOrders?.toLocaleString("en-IN")} />
      </div>
      {chartData.length > 0 && (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content mb-4">12-Month Revenue Trend</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-base-300)" />
                <XAxis dataKey="month" tick={{ fontSize: 10 }} />
                <YAxis tickFormatter={fmtShort} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [fmt(v), "Revenue"]} />
                <Bar dataKey="rev" fill="var(--color-primary)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}
      {topMeds.length > 0 && (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-5">
          <h3 className="font-bold text-sm uppercase tracking-widest text-base-content mb-4">Top 10 Medicines by Revenue</h3>
          <div className="space-y-2">
            {topMeds.map((m, i) => (
              <div key={i} className="flex items-center gap-3">
                <span className="text-xs font-bold text-base-content/40 w-5 text-right">{i + 1}</span>
                <div className="flex-1">
                  <div className="flex justify-between text-sm mb-0.5">
                    <span className="font-medium text-base-content truncate max-w-[55%]">{m.name}</span>
                    <span className="font-bold text-primary">{fmt(m.totalRevenue)}</span>
                  </div>
                  <div className="h-1.5 bg-base-300 rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all duration-500"
                      style={{ width: `${Math.min(100, (m.totalRevenue / topMeds[0].totalRevenue) * 100).toFixed(1)}%` }} />
                  </div>
                </div>
                <span className="text-xs text-base-content/40 w-16 text-right">{m.totalQty} units</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// History
function HistorySection() {
  const dispatch = useDispatch();
  const { earningsHistory, earningsHistoryPagination, earningsHistorySummary, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchEarningsHistory()); }, [dispatch]);
  if (loading.earningsHistory) return <SectionLoading />;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Earnings History</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Last 30 days paid orders</p>
      </motion.div>
      {earningsHistorySummary && (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard label="Total Revenue"  value={fmt(earningsHistorySummary.totalRevenue)} accent />
          <StatCard label="GST Amount"     value={fmt(earningsHistorySummary.totalGst)} />
          <StatCard label="Total Discount" value={fmt(earningsHistorySummary.totalDiscount)} />
        </div>
      )}
      {earningsHistory.length === 0 ? <EmptyState message="No paid orders in selected period" /> : (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-base-300 bg-base-200/60">
                  {["Order ID", "Customer", "Amount", "Payment", "Status", "Date"].map((h) => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-base-content/50">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {earningsHistory.map((o, i) => (
                  <tr key={o._id || i} className="border-b border-base-300/50 hover:bg-base-200/40 transition-colors">
                    <td className="px-4 py-3 font-mono text-xs text-primary font-bold">{o.orderId}</td>
                    <td className="px-4 py-3 text-base-content/70">{o.customer?.name || "—"}</td>
                    <td className="px-4 py-3 font-bold text-base-content">{fmt(o.billing?.totalPayable)}</td>
                    <td className="px-4 py-3">
                      <span className="badge badge-success text-xs">{o.payment?.method || "Paid"}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="badge badge-primary text-xs">{o.delivery?.status}</span>
                    </td>
                    <td className="px-4 py-3 text-xs text-base-content/50">{new Date(o.createdAt).toLocaleDateString("en-IN")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {earningsHistoryPagination?.totalPages > 1 && (
            <div className="px-4 py-3 border-t border-base-300 text-xs text-base-content/50">
              Page {earningsHistoryPagination.currentPage} of {earningsHistoryPagination.totalPages} · {earningsHistoryPagination.totalItems} records
            </div>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}

// Store Invoice
function StoreInvoiceSection() {
  const dispatch = useDispatch();
  const { storeInvoiceHtml, loading } = useSelector((s) => s.pharmacyStore);
  useEffect(() => { dispatch(fetchStoreInvoice()); }, [dispatch]);
  if (loading.storeInvoice) return <SectionLoading />;
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp} className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-black font-montserrat text-base-content">Store Invoice</h2>
          <p className="text-sm text-base-content/50 mt-0.5">Printable financial invoice for your store</p>
        </div>
        {storeInvoiceHtml && (
          <button onClick={() => {
            const w = window.open(); w.document.write(storeInvoiceHtml); w.print();
          }} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-content text-sm font-bold hover:bg-primary/90 transition-colors">
            <Download size={14} /> Print
          </button>
        )}
      </motion.div>
      {storeInvoiceHtml ? (
        <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl overflow-hidden">
          <iframe srcDoc={storeInvoiceHtml} className="w-full h-[600px] border-0" title="Store Invoice" />
        </motion.div>
      ) : <EmptyState message="No invoice data available" />}
    </motion.div>
  );
}

// Send Invoice
function SendInvoiceSection() {
  const dispatch = useDispatch();
  const { loading, success } = useSelector((s) => s.pharmacyStore);
  const handleSend = () => dispatch(sendStoreInvoice({ dateFilter: "last30days" }));
  return (
    <motion.div variants={stagger} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={fadeUp}>
        <h2 className="text-2xl font-black font-montserrat text-base-content">Send Invoice</h2>
        <p className="text-sm text-base-content/50 mt-0.5">Email the store invoice to yourself or a recipient</p>
      </motion.div>
      <motion.div variants={fadeUp} className="bg-base-100 border border-base-300 rounded-xl p-6 max-w-lg space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-semibold text-base-content">Date Filter</label>
          <select className="input-field w-full" defaultValue="last30days">
            <option value="today">Today</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
          </select>
        </div>
        <button onClick={handleSend} disabled={loading.sendStoreInvoice}
          className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg bg-primary text-primary-content text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-60">
          {loading.sendStoreInvoice ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
          {loading.sendStoreInvoice ? "Sending…" : "Send Invoice Email"}
        </button>
        {success.sendStoreInvoice && (
          <div className="alert alert-success text-sm">Invoice sent successfully!</div>
        )}
      </motion.div>
    </motion.div>
  );
}

// ─── SECTION MAP ──────────────────────────────────────────────────────────────
const SECTION_COMPONENTS = {
  // Settlements & Payments
  "payment-account":      PaymentAccountSection,
  bank:                   AddBankSection,
  upi:                    AddUpiSection,
  settlements:            SettlementsSection,
  "settlements-request":  RequestSettlementSection,
  "settlements-history":  SettlementHistorySection,
  daily:          DailySection,
  monthly:        MonthlySection,
  total:          TotalSection,
  history:        HistorySection,
  "store-invoice":StoreInvoiceSection,
  "send-invoice": SendInvoiceSection,
};

// ─── BREADCRUMB ───────────────────────────────────────────────────────────────
function Breadcrumb({ items }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-base-content/50 mb-6">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight size={12} />}
          <span className={i === items.length - 1 ? "text-base-content font-semibold" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}

// ─── SIDEBAR NAV ──────────────────────────────────────────────────────────────
function SidebarNav({ links, activeSection, title }) {
  const router = useRouter();
  return (
    <div className="space-y-1">
      <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 px-3 pb-2">{title}</p>
      {links.map(({ name, href, icon: Icon, section }) => {
        const isActive = section === activeSection;
        return (
          <button key={section} onClick={() => router.push(href)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 text-left
              ${isActive
                ? "bg-primary/10 text-primary border border-primary/20"
                : "text-base-content/60 hover:bg-base-200 hover:text-base-content"
              }`}
          >
            <Icon size={16} className={isActive ? "text-primary" : "text-base-content/40"} />
            <span className="flex-1 truncate">{name}</span>
            {isActive && <div className="w-1.5 h-1.5 rounded-full bg-primary" />}
          </button>
        );
      })}
    </div>
  );
}

// ─── MAIN EXPORT ──────────────────────────────────────────────────────────────
export default function FinancialReportsPage({ params }) {
  const pathname = usePathname();

  // Derive active section from URL segments
  const activeSection = useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    // e.g. /pharmacy-store/financials/daily → ["pharmacy-store","financials","daily"]
    // /pharmacy-store/financials/store-invoice/send → section = "send-invoice"
    const fin = segments.indexOf("financials");
    if (fin === -1) return "daily";
    const rest = segments.slice(fin + 1).join("/");

    // Map URL paths to section keys
    if (rest === "store-invoice/send") return "send-invoice";
    if (rest.startsWith("store-invoice")) return "store-invoice";
    if (rest === "daily")   return "daily";
    if (rest === "monthly") return "monthly";
    if (rest === "total")   return "total";
    if (rest === "history") return "history";

    // Settlement sub-routes
    if (rest === "payment-account/bank") return "bank";
    if (rest === "payment-account/upi")  return "upi";
    if (rest === "payment-account")      return "payment-account";
    if (rest === "settlements/request")  return "settlements-request";
    if (rest === "settlements/history")  return "settlements-history";
    if (rest === "settlements")          return "settlements";

    return rest;
  }, [pathname]);

  const allFinLinks = [...FINANCIAL_LINKS, ...SETTLEMENT_LINKS];
  const activeLink  = allFinLinks.find((l) => l.section === activeSection);
  const ActiveComp  = SECTION_COMPONENTS[activeSection];

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-200">
      <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-8">

        {/* Page header */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <h1 className="text-3xl font-black font-montserrat text-base-content">
            Financial Management
          </h1>
          <p className="text-sm text-base-content/50 mt-1">Manage your store earnings, invoices, and settlements</p>
        </motion.div>

        <div className="flex flex-col lg:flex-row gap-6">

          {/* ── Sidebar ── */}
          <motion.aside
            initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
            className="lg:w-64 xl:w-72 shrink-0"
          >
            <div className="bg-base-100 border border-base-300 rounded-2xl p-3 sticky top-6 space-y-5">
              <SidebarNav links={FINANCIAL_LINKS}   activeSection={activeSection} title="Reports" />
              <div className="border-t border-base-300" />
              <SidebarNav links={SETTLEMENT_LINKS} activeSection={activeSection} title="Settlements & Payments" />
            </div>
          </motion.aside>

          {/* ── Main content ── */}
          <main className="flex-1 min-w-0">
            <div className="bg-base-100 border border-base-300 rounded-2xl p-6">
              <Breadcrumb items={["Pharmacy", "Financials", activeLink?.name || activeSection]} />

              <AnimatePresence mode="wait">
                <motion.div key={activeSection}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25 }}
                >
                  {ActiveComp ? <ActiveComp /> : <EmptyState message="Section not implemented yet" />}
                </motion.div>
              </AnimatePresence>
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}