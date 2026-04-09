"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchStoreInvoice,
  sendStoreInvoice,
  clearStoreInvoice,
} from "@/store/slices/pharmacy/pharmacyStoreSlice";
import {
  FileText, Send, Download, Printer, CalendarDays, Eye,
  RefreshCw, Mail, X, ChevronDown, Sparkles, Clock,
} from "lucide-react";

/* ── Variants ─────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { type: "spring", stiffness: 260, damping: 22 } },
};
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

/* ── Paper-grain background ──────────────────────── */
function PaperBg() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")",
        }}
      />
      <motion.div
        animate={{ scale: [1, 1.08, 1], opacity: [0.1, 0.2, 0.1] }}
        transition={{ duration: 12, repeat: Infinity }}
        className="absolute -top-20 left-1/3 w-[500px] h-[500px] rounded-full blur-3xl"
        style={{ background: "radial-gradient(circle, var(--primary), transparent 70%)" }}
      />
    </div>
  );
}

/* ── Date filter options ─────────────────────────── */
const DATE_FILTERS = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last7days", label: "Last 7 Days" },
  { key: "last30days", label: "Last 30 Days" },
  { key: "custom", label: "Custom Range" },
];

/* ── Invoice preview modal ───────────────────────── */
function InvoicePreviewModal({ html, onClose, onPrint }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex flex-col"
      style={{ background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)" }}
    >
      <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <FileText size={16} className="text-primary" />
          <span className="font-bold text-white text-sm">Invoice Preview</span>
        </div>
        <div className="flex items-center gap-2">
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={onPrint}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 text-white text-xs font-bold hover:bg-white/20 transition-colors"
          >
            <Printer size={13} /> Print
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors"
          >
            <X size={14} />
          </motion.button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        <div
          className="max-w-3xl mx-auto bg-white rounded-2xl overflow-hidden shadow-2xl"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </motion.div>
  );
}

/* ── Send modal ──────────────────────────────────── */
function SendModal({ onClose, onSend, loading }) {
  const [email, setEmail] = useState("");
  const [filter, setFilter] = useState("last30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.88, opacity: 0, y: 30 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.88, opacity: 0, y: 30 }}
        transition={{ type: "spring", stiffness: 280, damping: 22 }}
        className="glass-card w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-primary/15">
              <Send size={16} className="text-primary" />
            </div>
            <h3 className="font-black text-base font-montserrat">Send Invoice</h3>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-base-300 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block mb-1.5">Recipient Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pharmacy@example.com (or leave blank for your account email)"
              className="input-field w-full text-sm"
            />
          </div>

          <div>
            <label className="block mb-1.5">Date Range</label>
            <div className="grid grid-cols-3 gap-1.5">
              {DATE_FILTERS.filter((f) => f.key !== "custom").map((f) => (
                <motion.button
                  key={f.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setFilter(f.key)}
                  className={`py-1.5 px-2 rounded-xl text-xs font-semibold transition-all ${
                    filter === f.key ? "bg-primary text-primary-content" : "bg-base-200 text-base-content/60 hover:bg-base-300"
                  }`}
                >
                  {f.label}
                </motion.button>
              ))}
            </div>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.97 }}
            disabled={loading}
            onClick={() => onSend({ dateFilter: filter, recipientEmail: email || undefined, startDate: startDate || undefined, endDate: endDate || undefined })}
            className="btn-primary-cta w-full flex items-center justify-center gap-2 text-sm"
          >
            {loading ? (
              <span className="spinner w-4 h-4" />
            ) : (
              <>
                <Mail size={14} /> Send Invoice
              </>
            )}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ── Main ────────────────────────────────────────── */
export default function StoreInvoices() {
  const dispatch = useDispatch();
  const { storeInvoiceHtml, loading, success } = useSelector((s) => s.pharmacyStore);

  const [dateFilter, setDateFilter] = useState("last30days");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [showSend, setShowSend] = useState(false);

  const handleGenerate = () => {
    dispatch(fetchStoreInvoice({
      dateFilter,
      ...(dateFilter === "custom" && startDate && { startDate }),
      ...(dateFilter === "custom" && endDate && { endDate }),
    }));
  };

  const handleSend = (params) => {
    dispatch(sendStoreInvoice(params));
    setShowSend(false);
  };

  const handlePrint = () => {
    const w = window.open("", "_blank");
    w.document.write(storeInvoiceHtml);
    w.document.close();
    w.print();
  };

  useEffect(() => {
    if (storeInvoiceHtml) setShowPreview(true);
  }, [storeInvoiceHtml]);

  useEffect(() => {
    return () => { dispatch(clearStoreInvoice()); };
  }, [dispatch]);

  return (
    <div className="min-h-screen flex flex-col" style={{ background: "var(--base-100)" }}>
      <PaperBg />
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 w-full">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={15} className="text-accent" />
            <span className="text-xs font-black uppercase tracking-widest text-accent/70">
              Document Center
            </span>
          </div>
          <h1 className="section-heading text-3xl lg:text-4xl">
            Store{" "}
            <span className="text-gradient-primary">Invoices</span>
          </h1>
          <p className="text-sm text-base-content/50 mt-2">
            Generate, preview, and dispatch professional store invoices
          </p>
        </motion.div>

        {/* Config card */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="glass-card p-6 mb-6"
        >
          <motion.div variants={fadeUp} className="flex items-center gap-2 mb-5">
            <CalendarDays size={16} className="text-primary" />
            <p className="font-bold text-sm text-base-content">Select Date Range</p>
          </motion.div>

          {/* Filter pills */}
          <motion.div variants={fadeUp} className="flex flex-wrap gap-2 mb-5">
            {DATE_FILTERS.map((f) => (
              <motion.button
                key={f.key}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() => setDateFilter(f.key)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                  dateFilter === f.key
                    ? "bg-primary text-primary-content shadow-primary/30 shadow-md"
                    : "bg-base-200 text-base-content/60 hover:bg-base-300"
                }`}
              >
                {f.label}
              </motion.button>
            ))}
          </motion.div>

          {/* Custom range */}
          <AnimatePresence>
            {dateFilter === "custom" && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="grid grid-cols-2 gap-4 mb-5"
              >
                <div>
                  <label className="block mb-1.5 text-xs">Start Date</label>
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
                <div>
                  <label className="block mb-1.5 text-xs">End Date</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field w-full text-sm"
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Actions */}
          <motion.div variants={fadeUp} className="flex flex-wrap gap-3">
            <motion.button
              whileHover={{ scale: 1.03, y: -1 }}
              whileTap={{ scale: 0.96 }}
              disabled={loading.storeInvoice}
              onClick={handleGenerate}
              className="btn-primary-cta flex items-center gap-2 text-sm px-5"
            >
              {loading.storeInvoice ? (
                <span className="spinner w-4 h-4" />
              ) : (
                <Eye size={14} />
              )}
              {loading.storeInvoice ? "Generating…" : "Preview Invoice"}
            </motion.button>

            {storeInvoiceHtml && (
              <>
                <motion.button
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={handlePrint}
                  className="btn-secondary flex items-center gap-2 text-sm px-5"
                >
                  <Printer size={14} /> Print / Save PDF
                </motion.button>

                <motion.button
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ scale: 1.03, y: -1 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() => setShowSend(true)}
                  className="btn-success flex items-center gap-2 text-sm px-5"
                >
                  <Send size={14} /> Email Invoice
                </motion.button>
              </>
            )}
          </motion.div>
        </motion.div>

        {/* Quick tips */}
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="show"
          className="grid sm:grid-cols-3 gap-4"
        >
          {[
            {
              icon: Eye,
              title: "Live Preview",
              desc: "See the exact formatted invoice before sending or printing.",
              color: "var(--primary)",
            },
            {
              icon: Printer,
              title: "Print to PDF",
              desc: "Opens print dialog — choose 'Save as PDF' in your browser.",
              color: "var(--secondary)",
            },
            {
              icon: Mail,
              title: "Email Dispatch",
              desc: "Send to your registered email or any custom recipient.",
              color: "var(--success)",
            },
          ].map(({ icon: Icon, title, desc, color }) => (
            <motion.div
              key={title}
              variants={fadeUp}
              className="glass-card p-4 flex gap-3"
            >
              <div
                className="p-2 rounded-xl shrink-0 h-fit"
                style={{ background: `color-mix(in oklch, ${color} 14%, var(--base-200))` }}
              >
                <Icon size={15} style={{ color }} />
              </div>
              <div>
                <p className="font-bold text-sm text-base-content">{title}</p>
                <p className="text-xs text-base-content/50 mt-0.5 leading-relaxed">{desc}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* Success toast inline */}
        <AnimatePresence>
          {success.sendStoreInvoice && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="fixed bottom-6 right-6 glass-card px-4 py-3 flex items-center gap-2 border-success/40 border"
            >
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <p className="text-sm font-semibold text-success">Invoice sent successfully!</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {showPreview && storeInvoiceHtml && (
          <InvoicePreviewModal
            html={storeInvoiceHtml}
            onClose={() => setShowPreview(false)}
            onPrint={handlePrint}
          />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showSend && (
          <SendModal
            onClose={() => setShowSend(false)}
            onSend={handleSend}
            loading={loading.sendStoreInvoice}
          />
        )}
      </AnimatePresence>
    </div>
  );
}