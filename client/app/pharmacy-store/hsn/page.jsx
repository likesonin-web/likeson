'use client';

/**
 * HsnManagement.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Pharmacy HSN Code Management Page  — READ-ONLY for pharmacy role
 *
 * Router auth reality check:
 *   GET  /hsn            → pharmacy ✓ admin ✓ superadmin ✓
 *   GET  /hsn/stats      → admin ✓ superadmin ✓  — pharmacy ✗
 *   GET  /hsn/:code      → pharmacy ✓ admin ✓ superadmin ✓
 *   POST /hsn            → admin ✓ superadmin ✓  — pharmacy ✗
 *   PATCH /hsn/:code     → admin ✓ superadmin ✓  — pharmacy ✗
 *   DELETE /hsn/:code    → superadmin ✓           — pharmacy ✗
 *   POST /hsn/bulk-delete→ superadmin ✓           — pharmacy ✗
 *   POST /hsn/upload     → admin ✓ superadmin ✓  — pharmacy ✗
 *
 * Pharmacy page: list + search + filter + view single. No mutations.
 * Stack: Next.js · TailwindCSS · Framer Motion · Lucide · global.css
 * ─────────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Hash, Search, RefreshCw, ChevronLeft, ChevronRight,
  X, Info, Eye, Tag, AlertCircle, Loader2,
  Percent, BookOpen, ShieldCheck, Filter,
} from 'lucide-react';

import {
  fetchHsnCodes,
  fetchHsnCode,
  clearCurrentHsnCode,
} from '@/store/slices/pharmacy/pharmacyStoreSlice';

// ─────────────────────────────────────────────────────────────────────────────
// § CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const GST_SLABS = [0, 5, 12, 18, 28];

const SORT_OPTIONS = [
  { value: 'hsnCode',      label: 'HSN Code (A→Z)' },
  { value: 'hsnCode_desc', label: 'HSN Code (Z→A)' },
  { value: 'gst_asc',      label: 'GST % (Low→High)' },
  { value: 'newest',       label: 'Newest First' },
];

// ─────────────────────────────────────────────────────────────────────────────
// § ANIMATION VARIANTS
// ─────────────────────────────────────────────────────────────────────────────

const STAGGER = {
  hidden:  {},
  visible: { transition: { staggerChildren: 0.05 } },
};

const ITEM = {
  hidden:  { opacity: 0, y: 14 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.32, ease: 'easeOut' } },
};

const FADE_UP = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.38, ease: 'easeOut' } },
};

const MODAL_OVERLAY = {
  hidden:  { opacity: 0 },
  visible: { opacity: 1 },
};

const MODAL_PANEL = {
  hidden:  { opacity: 0, scale: 0.94, y: 18 },
  visible: { opacity: 1, scale: 1,    y: 0, transition: { duration: 0.26, ease: 'easeOut' } },
  exit:    { opacity: 0, scale: 0.94, y: 18, transition: { duration: 0.18 } },
};

// ─────────────────────────────────────────────────────────────────────────────
// § MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

function GstBadge({ gst }) {
  const map = {
    0:  'badge-success',
    5:  'badge-info',
    12: 'badge-accent',
    18: 'badge-warning',
    28: 'badge-error',
  };
  return (
    <span className={`badge badge-xs ${map[gst] ?? 'badge-secondary'}`}>
      {gst}% GST
    </span>
  );
}

function ActiveBadge({ isActive }) {
  return isActive
    ? <span className="badge badge-xs badge-success">Active</span>
    : <span className="badge badge-xs badge-error">Inactive</span>;
}

function SourceBadge({ source }) {
  const map = {
    excel:  'badge-primary',
    pdf:    'badge-accent',
    manual: 'badge-secondary',
    api:    'badge-info',
  };
  return (
    <span className={`badge badge-xs ${map[source] ?? 'badge-secondary'}`}>
      {source ?? 'manual'}
    </span>
  );
}

function EmptyState({ title, body }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 gap-4">
      <div className="p-4 rounded-full bg-base-200">
        <Hash size={32} className="text-base-content/30" />
      </div>
      <p className="text-base-content/50 font-semibold text-sm">{title}</p>
      {body && (
        <p className="text-xs text-base-content/40 text-center max-w-xs">{body}</p>
      )}
    </div>
  );
}

function Pagination({ page, totalPages, onPrev, onNext, totalItems }) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center gap-3 justify-between pt-4 border-t border-base-300">
      <span className="text-xs text-base-content/40">
        {totalItems.toLocaleString()} total codes
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={onPrev}
          disabled={page === 1}
          className="btn btn-sm btn-ghost"
        >
          <ChevronLeft size={15} />
        </button>
        <span className="text-xs text-base-content/60 font-medium min-w-[80px] text-center">
          Page {page} / {totalPages}
        </span>
        <button
          onClick={onNext}
          disabled={page === totalPages}
          className="btn btn-sm btn-ghost"
        >
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § VIEW MODAL — read-only detail panel
// ─────────────────────────────────────────────────────────────────────────────

function HsnViewModal({ hsnCode: code, onClose }) {
  const dispatch = useDispatch();
  const { currentHsnCode, loading, errors } = useSelector(s => s.pharmacyStore);

  useEffect(() => {
    if (code) dispatch(fetchHsnCode(code));
    return () => dispatch(clearCurrentHsnCode());
  }, [code]);

  const hsn = currentHsnCode;

  const gstRows = hsn ? [
    { label: 'CGST', value: `${hsn.cgstPercentage ?? hsn.gstPercentage / 2}%` },
    { label: 'SGST', value: `${hsn.sgstPercentage ?? hsn.gstPercentage / 2}%` },
    { label: 'IGST', value: `${hsn.igstPercentage ?? hsn.gstPercentage}%` },
  ] : [];

  return (
    <motion.div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
      variants={MODAL_OVERLAY}
      initial="hidden"
      animate="visible"
      exit="hidden"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        className="card w-full max-w-md overflow-hidden"
        variants={MODAL_PANEL}
        initial="hidden"
        animate="visible"
        exit="exit"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-base-300">
          <div className="flex items-center gap-2">
            <Tag size={16} className="text-primary" />
            <h3 className="font-montserrat font-bold text-base-content">
              {code}
            </h3>
            {hsn && <GstBadge gst={hsn.gstPercentage} />}
          </div>
          <button onClick={onClose} className="btn btn-xs btn-ghost btn-circle">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 min-h-[200px]">
          {loading.hsnCode ? (
            <div className="flex items-center justify-center py-12 gap-3 text-base-content/40">
              <Loader2 size={20} className="animate-spin text-primary" />
              <span className="text-sm">Fetching code details…</span>
            </div>
          ) : errors.hsnCode ? (
            <div className="alert alert-error text-sm">
              <AlertCircle size={15} />
              {errors.hsnCode?.message ?? 'Failed to load HSN code'}
            </div>
          ) : hsn ? (
            <div className="flex flex-col gap-5">

              {/* Description */}
              <div>
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-1">
                  Description
                </p>
                <p className="text-sm text-base-content leading-relaxed">{hsn.description}</p>
              </div>

              {/* Chapter */}
              {hsn.chapterHeading && (
                <div>
                  <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-1">
                    Chapter Heading
                  </p>
                  <p className="text-sm text-base-content">{hsn.chapterHeading}</p>
                </div>
              )}

              {/* GST breakdown */}
              <div>
                <p className="text-xs text-base-content/50 uppercase tracking-wider font-semibold mb-2">
                  GST Breakdown
                </p>
                <div className="grid grid-cols-3 gap-3">
                  {gstRows.map(r => (
                    <div key={r.label} className="stat-card text-center py-3">
                      <p className="text-lg font-montserrat font-black text-primary">{r.value}</p>
                      <p className="stat-card-label">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Meta row */}
              <div className="flex flex-wrap gap-3 pt-1">
                <div className="flex items-center gap-1.5 text-xs text-base-content/50">
                  <ShieldCheck size={12} className="text-base-content/30" />
                  <ActiveBadge isActive={hsn.isActive} />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-base-content/50">
                  <BookOpen size={12} className="text-base-content/30" />
                  <SourceBadge source={hsn.uploadSource} />
                </div>
              </div>
            </div>
          ) : null}
        </div>

        {/* Footer */}
        <div className="flex justify-end px-6 py-4 border-t border-base-300">
          <button onClick={onClose} className="btn btn-sm btn-ghost">Close</button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § QUICK LOOKUP PANEL — single code search
// ─────────────────────────────────────────────────────────────────────────────

function QuickLookup() {
  const dispatch = useDispatch();
  const { currentHsnCode, loading, errors } = useSelector(s => s.pharmacyStore);

  const [input, setInput] = useState('');
  const [searched, setSearched] = useState(false);

  const lookup = () => {
    const code = input.trim().toUpperCase();
    if (!code || !/^\d{4,8}$/.test(code)) return;
    dispatch(fetchHsnCode(code));
    setSearched(true);
  };

  const reset = () => {
    setInput('');
    setSearched(false);
    dispatch(clearCurrentHsnCode());
  };

  const hsn = currentHsnCode;

  return (
    <motion.div variants={ITEM} className="card p-5 flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Percent size={15} className="text-primary" />
        <h4 className="font-montserrat font-bold text-base-content text-sm">Quick GST Lookup</h4>
      </div>

      <div className="flex gap-2">
        <input
          className="input-field flex-1 text-sm"
          placeholder="Enter HSN code (e.g. 30049099)"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && lookup()}
          maxLength={8}
        />
        <button onClick={lookup} disabled={loading.hsnCode || !input.trim()} className="btn btn-primary btn-sm">
          {loading.hsnCode ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
          Lookup
        </button>
        {searched && (
          <button onClick={reset} className="btn btn-ghost btn-sm">
            <X size={14} />
          </button>
        )}
      </div>

      <AnimatePresence mode="wait">
        {searched && (
          <motion.div variants={FADE_UP} initial="hidden" animate="visible" exit="hidden">
            {loading.hsnCode ? (
              <div className="flex items-center gap-2 text-xs text-base-content/40 py-4 justify-center">
                <Loader2 size={14} className="animate-spin text-primary" />
                Fetching…
              </div>
            ) : errors.hsnCode ? (
              <div className="alert alert-error text-xs">
                <AlertCircle size={13} />
                {errors.hsnCode?.message ?? 'HSN code not found or inactive'}
              </div>
            ) : hsn ? (
              <div className="rounded-xl bg-base-200 border border-base-300 p-4 flex flex-col gap-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-montserrat font-black text-primary text-lg">{hsn.hsnCode}</span>
                    <GstBadge gst={hsn.gstPercentage} />
                    <ActiveBadge isActive={hsn.isActive} />
                  </div>
                </div>
                <p className="text-xs text-base-content/70 leading-relaxed">{hsn.description}</p>
                {hsn.chapterHeading && (
                  <p className="text-xs text-base-content/50">{hsn.chapterHeading}</p>
                )}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'CGST', value: `${hsn.cgstPercentage ?? hsn.gstPercentage / 2}%` },
                    { label: 'SGST', value: `${hsn.sgstPercentage ?? hsn.gstPercentage / 2}%` },
                    { label: 'IGST', value: `${hsn.igstPercentage ?? hsn.gstPercentage}%` },
                  ].map(r => (
                    <div key={r.label} className="stat-card text-center py-2">
                      <p className="text-base font-montserrat font-black text-primary">{r.value}</p>
                      <p className="stat-card-label text-xs">{r.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// § MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function HsnManagement() {
  const dispatch = useDispatch();
  const {
    hsnCodes, hsnCodesTotal, hsnCodesPagination,
    loading, errors,
  } = useSelector(s => s.pharmacyStore);

  const [search,      setSearch]      = useState('');
  const [gstFilter,   setGstFilter]   = useState('');
  const [activeFilter,setActiveFilter]= useState('true');
  const [sort,        setSort]        = useState('hsnCode');
  const [page,        setPage]        = useState(1);
  const [viewCode,    setViewCode]    = useState(null);

  const debounceRef = useRef(null);

  const load = useCallback(() => {
    dispatch(fetchHsnCodes({
      search, gst: gstFilter, isActive: activeFilter,
      page, limit: 20, sort,
    }));
  }, [search, gstFilter, activeFilter, page, sort]);

  // Load on filter/sort/page change
  useEffect(() => { load(); }, [page, sort, gstFilter, activeFilter]);

  // Debounce search
  useEffect(() => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setPage(1); load(); }, 400);
    return () => clearTimeout(debounceRef.current);
  }, [search]);

  // Reset page on filter change
  useEffect(() => { setPage(1); }, [gstFilter, activeFilter, sort]);

  const totalPages = hsnCodesPagination?.totalPages ?? 1;

  return (
    <div data-theme="pharmacy" className="min-h-screen bg-base-100">
      <div className="container-custom py-8 max-w-7xl">

        {/* ── Page Header ── */}
        <motion.div variants={FADE_UP} initial="hidden" animate="visible" className="mb-8">
          <div className="flex items-start gap-3 flex-wrap">
            <div className="p-2.5 rounded-xl bg-primary/10 flex-shrink-0">
              <Hash size={22} className="text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2 mb-0.5">
                <span className="badge badge-primary badge-xs">Pharmacy</span>
                <span className="badge badge-secondary badge-xs">Read-only</span>
              </div>
              <h1 className="font-montserrat font-black text-base-content text-2xl md:text-3xl tracking-tight">
                HSN Code Reference
              </h1>
              <p className="text-base-content/50 text-sm mt-1 max-w-xl">
                Browse Harmonised System of Nomenclature codes — view GST slabs, CGST/SGST/IGST breakdowns, and chapter headings for medicines.
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Two-column layout ── */}
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-6 items-start">

          {/* LEFT — Codes Table */}
          <div className="flex flex-col gap-4">

            {/* Toolbar */}
            <motion.div
              variants={FADE_UP}
              initial="hidden"
              animate="visible"
              className="flex flex-wrap gap-3 items-center justify-between"
            >
              <div className="flex flex-wrap gap-2 items-center">
                {/* Search */}
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
                  <input
                    className="input-field pl-9 w-52 text-sm"
                    placeholder="Search code or description…"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                  />
                </div>

                {/* GST filter */}
                <div className="relative">
                  <Filter size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40 pointer-events-none" />
                  <select
                    className="input-field pl-8 w-38 text-sm"
                    value={gstFilter}
                    onChange={e => setGstFilter(e.target.value)}
                  >
                    <option value="">All GST Slabs</option>
                    {GST_SLABS.map(s => (
                      <option key={s} value={s}>{s}% GST</option>
                    ))}
                  </select>
                </div>

                {/* Active filter */}
                <select
                  className="input-field w-32 text-sm"
                  value={activeFilter}
                  onChange={e => setActiveFilter(e.target.value)}
                >
                  <option value="true">Active only</option>
                  <option value="false">Inactive</option>
                  <option value="all">All</option>
                </select>

                {/* Sort */}
                <select
                  className="input-field w-44 text-sm"
                  value={sort}
                  onChange={e => setSort(e.target.value)}
                >
                  {SORT_OPTIONS.map(o => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              </div>

              <button onClick={load} className="btn btn-sm btn-ghost" title="Refresh">
                <RefreshCw size={14} />
              </button>
            </motion.div>

            {/* Count row */}
            <div className="flex items-center gap-1.5 text-xs text-base-content/40">
              <Info size={11} />
              <span>{hsnCodesTotal.toLocaleString()} codes match current filters</span>
            </div>

            {/* Error */}
            {errors.hsnCodes && (
              <div className="alert alert-error text-sm">
                <AlertCircle size={15} />
                {errors.hsnCodes?.message ?? 'Failed to load HSN codes'}
              </div>
            )}

            {/* Table card */}
            <div className="card overflow-hidden">
              {loading.hsnCodes ? (
                <div className="flex items-center justify-center py-20 gap-3 text-base-content/40">
                  <Loader2 size={20} className="animate-spin text-primary" />
                  <span className="text-sm">Loading codes…</span>
                </div>
              ) : hsnCodes.length === 0 ? (
                <EmptyState
                  title="No HSN codes found"
                  body="Try adjusting filters or search terms."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>HSN Code</th>
                          <th>Description</th>
                          <th>Chapter</th>
                          <th>GST</th>
                          <th>CGST / SGST</th>
                          <th>Source</th>
                          <th>Status</th>
                          <th className="text-right w-16">Details</th>
                        </tr>
                      </thead>
                      <motion.tbody
                        variants={STAGGER}
                        initial="hidden"
                        animate="visible"
                      >
                        {hsnCodes.map(hsn => (
                          <motion.tr key={hsn._id ?? hsn.hsnCode} variants={ITEM}>
                            <td>
                              <span className="font-montserrat font-bold text-primary text-sm tracking-wide">
                                {hsn.hsnCode}
                              </span>
                            </td>
                            <td>
                              <span className="text-sm text-base-content line-clamp-2 max-w-xs">
                                {hsn.description}
                              </span>
                            </td>
                            <td>
                              <span className="text-xs text-base-content/55 max-w-[130px] truncate block">
                                {hsn.chapterHeading || '—'}
                              </span>
                            </td>
                            <td>
                              <GstBadge gst={hsn.gstPercentage} />
                            </td>
                            <td>
                              <span className="text-xs text-base-content/60 font-mono">
                                {hsn.cgstPercentage ?? hsn.gstPercentage / 2}%
                                {' / '}
                                {hsn.sgstPercentage ?? hsn.gstPercentage / 2}%
                              </span>
                            </td>
                            <td>
                              <SourceBadge source={hsn.uploadSource} />
                            </td>
                            <td>
                              <ActiveBadge isActive={hsn.isActive} />
                            </td>
                            <td className="text-right">
                              <button
                                onClick={() => setViewCode(hsn.hsnCode)}
                                className="btn btn-xs btn-ghost btn-circle"
                                title="View details"
                              >
                                <Eye size={13} />
                              </button>
                            </td>
                          </motion.tr>
                        ))}
                      </motion.tbody>
                    </table>
                  </div>

                  <div className="px-5 pb-5">
                    <Pagination
                      page={page}
                      totalPages={totalPages}
                      totalItems={hsnCodesTotal}
                      onPrev={() => setPage(p => p - 1)}
                      onNext={() => setPage(p => p + 1)}
                    />
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT — Quick lookup sidebar */}
          <motion.div
            className="flex flex-col gap-4 xl:sticky xl:top-6"
            variants={STAGGER}
            initial="hidden"
            animate="visible"
          >
            <QuickLookup />

            {/* Info panel */}
            <motion.div variants={ITEM} className="card p-5 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <Info size={14} className="text-primary" />
                <h4 className="font-montserrat font-bold text-base-content text-sm">GST Slabs</h4>
              </div>
              <div className="flex flex-col gap-2">
                {[
                  { slab: 0,  desc: 'Life-saving drugs (insulin, blood products)' },
                  { slab: 5,  desc: 'Most medicines, APIs, Ayurvedic formulations' },
                  { slab: 12, desc: 'Patent-protected drugs, medical devices' },
                  { slab: 18, desc: 'Cosmetics / toiletries classified as OTC' },
                  { slab: 28, desc: 'High-end OTC, premium cosmetics' },
                ].map(r => (
                  <div key={r.slab} className="flex items-start gap-2">
                    <div className="pt-0.5 flex-shrink-0">
                      <GstBadge gst={r.slab} />
                    </div>
                    <p className="text-xs text-base-content/60 leading-relaxed">{r.desc}</p>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Permission notice */}
            <motion.div variants={ITEM} className="alert alert-info text-xs">
              <Info size={13} className="text-info flex-shrink-0" />
              <span>
                HSN code creation, editing, and bulk upload require <strong>Admin</strong> or{' '}
                <strong>Super Admin</strong> access. Contact your administrator for changes.
              </span>
            </motion.div>
          </motion.div>
        </div>
      </div>

      {/* View Modal */}
      <AnimatePresence>
        {viewCode && (
          <HsnViewModal
            key={viewCode}
            hsnCode={viewCode}
            onClose={() => setViewCode(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}