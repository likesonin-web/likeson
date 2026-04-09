"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, MousePointer2, Eye,
  Target, DollarSign, Upload,
  Trash2, Edit3, X, Layers,
  Calendar, Clock, MapPin, ShieldCheck, Activity,
  Smartphone, Monitor, Zap, Link as LinkIcon, Type,
  MousePointerClick, TrendingUp, BarChart3, Filter,
  ChevronRight, AlertCircle, CheckCircle2, PauseCircle,
  Archive, Crosshair, Radio, Globe, Tag
} from 'lucide-react';

import {
  fetchAllAds,
  createAd,
  updateAd,
  archiveAd,
  getAdAnalytics,
} from '@/store/slices/adsSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG = {
  Active:   { icon: CheckCircle2,  color: '#22c55e', bg: 'rgba(34,197,94,0.12)',   label: 'Active'   },
  Paused:   { icon: PauseCircle,   color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  label: 'Paused'   },
  Draft:    { icon: Radio,         color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'Draft'    },
  Depleted: { icon: AlertCircle,   color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Depleted' },
  Archived: { icon: Archive,       color: '#6366f1', bg: 'rgba(99,102,241,0.12)',  label: 'Archived' },
};

// ─── Initial form state — mirrors full Mongoose schema ───────────────────────
const INITIAL_FORM = {
  advertiser: {
    name: '',
    type: 'Internal',
    campaignId: null,
  },
  adContent: {
    headline: '',
    subHeadline: '',
    mediaUrl: '',
    mediaType: 'Image',
    ctaText: 'Learn More',
    landingPageUrl: '',
  },
  placement: {
    page: 'Global',
    slot: 'Native_Feed',
    priority: 1,
  },
  targeting: {
    deviceType: ['Web', 'iOS', 'Android'],
    userSegments: [],
    location: {
      type: 'Point',
      coordinates: [0, 0],
    },
    radiusInKm: 5,
  },
  schedule: {
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
    displayHours: [],
    frequencyCap: {
      limit: 3,
      windowHours: 24,
    },
  },
  pricingModel: 'CPC',
  budget: {
    totalMax: 0,
    dailyMax: 0,
    currentSpend: 0,
  },
  analytics: {
    views: 0,
    clicks: 0,
    conversions: 0,
    lastEventAt: null,
  },
  status: 'Active',
};

// ─── Small UI helpers ─────────────────────────────────────────────────────────
const Label = ({ children }) => (
  <span className="block text-[10px] font-bold tracking-[0.15em] uppercase opacity-40 mb-1.5 ml-0.5">
    {children}
  </span>
);

const Field = ({ label, children }) => (
  <div className="space-y-0">
    <Label>{label}</Label>
    {children}
  </div>
);

const StatBadge = ({ status }) => {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.Draft;
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wide"
      style={{ color: cfg.color, background: cfg.bg }}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
};

const SectionHeading = ({ icon: Icon, children }) => (
  <div className="flex items-center gap-2 mb-6">
    <div className="p-1.5 rounded-lg bg-primary/10">
      <Icon size={15} className="text-primary" />
    </div>
    <h4 className="text-xs font-extrabold uppercase tracking-[0.15em] text-primary">{children}</h4>
    <div className="flex-1 h-px bg-primary/10 ml-2" />
  </div>
);

// ─── Display hours grid (0-23) ────────────────────────────────────────────────
const HoursGrid = ({ value, onChange }) => (
  <div className="grid grid-cols-12 gap-1">
    {Array.from({ length: 24 }, (_, h) => {
      const active = value.includes(h);
      return (
        <button
          key={h}
          type="button"
          onClick={() => onChange(active ? value.filter((x) => x !== h) : [...value, h])}
          className={`h-7 rounded text-[10px] font-mono font-bold transition-all ${
            active
              ? 'bg-primary text-primary-content shadow-sm'
              : 'bg-base-200 text-base-content/40 hover:bg-base-300'
          }`}
        >
          {h}
        </button>
      );
    })}
  </div>
);

// ─── Budget utilisation bar ───────────────────────────────────────────────────
const BudgetBar = ({ current, total, status }) => {
  const pct = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const depleted = status === 'Depleted' || pct >= 100;
  return (
    <div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className={`h-full rounded-full ${depleted ? 'bg-error' : 'bg-primary'}`}
      />
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
const AdvertisementManagement = () => {
  const dispatch = useDispatch();
  const { allAds = [], analytics = {}, loading = false } = useSelector((s) => s.ads);
  const { isUploading = false, lastUploadedUrl = null } = useSelector((s) => s.upload);
  const { user } = useSelector((s) => s.user);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [searchTerm,     setSearchTerm]     = useState('');
  const [filters,        setFilters]        = useState({ page: 'all', status: 'all' });
  const [selectedAd,     setSelectedAd]     = useState(null);
  const [isSidebarOpen,  setIsSidebarOpen]  = useState(false);
  const [isEditMode,     setIsEditMode]     = useState(false);
  const [segmentInput,   setSegmentInput]   = useState('');
  const [formData,       setFormData]       = useState(INITIAL_FORM);

  // ── Bootstrap ─────────────────────────────────────────────────────────────
  useEffect(() => {
    dispatch(fetchAllAds());
    dispatch(getAdAnalytics());
  }, [dispatch]);

  // ── Sync uploaded URL into form ───────────────────────────────────────────
  useEffect(() => {
    if (lastUploadedUrl) {
      setFormData((p) => ({
        ...p,
        adContent: { ...p.adContent, mediaUrl: lastUploadedUrl },
      }));
    }
  }, [lastUploadedUrl]);

  // ── Derived filtered list ─────────────────────────────────────────────────
  const filteredAds = useMemo(() => {
    return (allAds || []).filter((ad) => {
      const hl  = (ad.adContent?.headline  || '').toLowerCase();
      const adv = (ad.advertiser?.name     || '').toLowerCase();
      const q   = searchTerm.toLowerCase();
      return (
        (hl.includes(q) || adv.includes(q)) &&
        (filters.page   === 'all' || ad.placement?.page   === filters.page) &&
        (filters.status === 'all' || ad.status             === filters.status)
      );
    });
  }, [allAds, searchTerm, filters]);

  // ── Nested helpers ────────────────────────────────────────────────────────
  const set = (path, value) => {
    setFormData((prev) => {
      const clone = structuredClone(prev);
      const keys  = path.split('.');
      let   obj   = clone;
      for (let i = 0; i < keys.length - 1; i++) obj = obj[keys[i]];
      obj[keys[keys.length - 1]] = value;
      return clone;
    });
  };

  // ── Open sidebar ──────────────────────────────────────────────────────────
  const openCreate = () => {
    setFormData(INITIAL_FORM);
    setSegmentInput('');
    setIsEditMode(false);
    setIsSidebarOpen(true);
  };

  const openEdit = (ad) => {
    setFormData({
      ...ad,
      schedule: {
        ...ad.schedule,
        startDate: ad.schedule?.startDate
          ? new Date(ad.schedule.startDate).toISOString().split('T')[0]
          : '',
        endDate: ad.schedule?.endDate
          ? new Date(ad.schedule.endDate).toISOString().split('T')[0]
          : '',
        displayHours: ad.schedule?.displayHours ?? [],
        frequencyCap: {
          limit:       ad.schedule?.frequencyCap?.limit       ?? 3,
          windowHours: ad.schedule?.frequencyCap?.windowHours ?? 24,
        },
      },
      targeting: {
        ...ad.targeting,
        deviceType:   ad.targeting?.deviceType   ?? [],
        userSegments: ad.targeting?.userSegments ?? [],
        location: {
          type:        ad.targeting?.location?.type        ?? 'Point',
          coordinates: ad.targeting?.location?.coordinates ?? [0, 0],
        },
        radiusInKm: ad.targeting?.radiusInKm ?? 5,
      },
      budget: {
        totalMax:    ad.budget?.totalMax    ?? 0,
        dailyMax:    ad.budget?.dailyMax    ?? 0,
        currentSpend:ad.budget?.currentSpend?? 0,
      },
      analytics: {
        views:       ad.analytics?.views       ?? 0,
        clicks:      ad.analytics?.clicks      ?? 0,
        conversions: ad.analytics?.conversions ?? 0,
        lastEventAt: ad.analytics?.lastEventAt ?? null,
      },
    });
    setSegmentInput('');
    setIsEditMode(true);
    setIsSidebarOpen(true);
  };

  // ── Submit ────────────────────────────────────────────────────────────────
  const handleSubmit = (e) => {
    e.preventDefault();
    const payload = { ...formData };
    if (isEditMode) {
      dispatch(updateAd({ id: formData._id, adData: payload }));
    } else {
      dispatch(createAd({ ...payload, createdBy: user?._id }));
    }
    setIsSidebarOpen(false);
    setIsEditMode(false);
    setFormData(INITIAL_FORM);
    setSegmentInput('');
  };

  // ── Device toggle ─────────────────────────────────────────────────────────
  const toggleDevice = (device, checked) => {
    const curr = formData.targeting.deviceType;
    set('targeting.deviceType', checked ? [...curr, device] : curr.filter((d) => d !== device));
  };

  // ── Segment tag helpers ───────────────────────────────────────────────────
  const addSegment = () => {
    const v = segmentInput.trim();
    if (v && !formData.targeting.userSegments.includes(v)) {
      set('targeting.userSegments', [...formData.targeting.userSegments, v]);
    }
    setSegmentInput('');
  };

  const removeSegment = (seg) => {
    set('targeting.userSegments', formData.targeting.userSegments.filter((s) => s !== seg));
  };

  // ── Summary stats ─────────────────────────────────────────────────────────
  const totalViews       = analytics?.totalViews   ?? allAds.reduce((s, a) => s + (a.analytics?.views   ?? 0), 0);
  const totalClicks      = analytics?.totalClicks  ?? allAds.reduce((s, a) => s + (a.analytics?.clicks  ?? 0), 0);
  const avgCtr           = analytics?.avgCtr       ?? (totalViews > 0 ? (totalClicks / totalViews) * 100 : 0);
  const activeCount      = allAds.filter((a) => a.status === 'Active').length;

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 p-6 space-y-8 max-w-[1680px] mx-auto">

      {/* ── ANALYTICS STRIP ────────────────────────────────────────────── */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          { label: 'Total Impressions', value: totalViews.toLocaleString(),         icon: Eye,          color: '#6366f1' },
          { label: 'Total Clicks',      value: totalClicks.toLocaleString(),        icon: MousePointer2,color: '#0ea5e9' },
          { label: 'Avg CTR',           value: `${avgCtr.toFixed(2)}%`,             icon: TrendingUp,   color: '#10b981' },
          { label: 'Active Units',      value: activeCount,                         icon: Activity,     color: '#f59e0b' },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            className="glass-card p-6 flex items-center justify-between group overflow-hidden relative"
            style={{ borderLeft: `3px solid ${s.color}` }}
          >
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.15em] opacity-40 mb-1">{s.label}</p>
              <p className="text-3xl font-black font-mono">{s.value}</p>
            </div>
            <motion.div
              animate={{ y: [0, -6, 0] }}
              transition={{ duration: 3 + i * 0.5, repeat: Infinity, ease: 'easeInOut' }}
              className="p-3 rounded-2xl"
              style={{ background: `${s.color}18`, color: s.color }}
            >
              <s.icon size={26} strokeWidth={2} />
            </motion.div>
            <div
              className="absolute inset-0 opacity-0 group-hover:opacity-[0.04] transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle at 80% 50%, ${s.color}, transparent)` }}
            />
          </motion.div>
        ))}
      </section>

      {/* ── TOOLBAR ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3 glass-card p-4 sticky top-4 z-20 bg-base-100/80 backdrop-blur-lg border border-base-300 rounded-2xl shadow-lg">
        <div className="relative flex-1 min-w-[260px]">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
          <input
            type="text"
            placeholder="Search headline or brand…"
            className="input-field w-full pl-10 text-sm"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Filter size={14} className="opacity-30 shrink-0" />
          <select
            className="input-field text-xs py-2"
            value={filters.page}
            onChange={(e) => setFilters((f) => ({ ...f, page: e.target.value }))}
          >
            <option value="all">All Pages</option>
            <option value="Global">Global</option>
            <option value="Search_Results">Search Results</option>
            <option value="Medicine_Store">Medicine Store</option>
            <option value="Ride_Tracking_Screen">Ride Tracking</option>
          </select>

          <select
            className="input-field text-xs py-2"
            value={filters.status}
            onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
          >
            <option value="all">All Statuses</option>
            {Object.keys(STATUS_CONFIG).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        <button onClick={openCreate} className="btn-primary-cta flex items-center gap-2 px-7 ml-auto shrink-0">
          <Plus size={18} /> Create Ad
        </button>
      </div>

      {/* ── AD GRID ────────────────────────────────────────────────────── */}
      {filteredAds.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-32 opacity-30 gap-4">
          <BarChart3 size={48} strokeWidth={1} />
          <p className="text-sm font-bold uppercase tracking-widest">No ads match your filters</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          <AnimatePresence mode="popLayout">
            {filteredAds.map((ad) => {
              const ctr = ad.analytics?.views > 0
                ? ((ad.analytics.clicks / ad.analytics.views) * 100).toFixed(1)
                : '0.0';
              return (
                <motion.div
                  layout
                  key={ad._id}
                  initial={{ opacity: 0, scale: 0.92 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  whileHover={{ y: -6 }}
                  className="glass-card group cursor-pointer overflow-hidden flex flex-col h-full"
                  onClick={() => setSelectedAd(ad)}
                >
                  {/* Media preview */}
                  <div className="relative aspect-video bg-base-200 overflow-hidden">
                    {ad.adContent?.mediaUrl ? (
                      ad.adContent.mediaType === 'Video' ? (
                        <video
                          src={ad.adContent.mediaUrl}
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          muted
                        />
                      ) : (
                        <img
                          src={ad.adContent.mediaUrl}
                          alt="preview"
                          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                          onError={(e) => { e.target.style.display = 'none'; }}
                        />
                      )
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-base-content/20">
                        <Layers size={32} strokeWidth={1} />
                      </div>
                    )}

                    {/* Status badge */}
                    <div className="absolute top-2 left-2">
                      <StatBadge status={ad.status} />
                    </div>

                    {/* Page badge */}
                    <div className="absolute top-2 right-2 px-2 py-0.5 bg-base-100/90 rounded text-[9px] font-bold uppercase tracking-wide opacity-80">
                      {ad.placement?.page?.replace('_', ' ')}
                    </div>
                  </div>

                  {/* Body */}
                  <div className="p-5 flex-1 flex flex-col gap-3">
                    <div>
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="font-black text-base leading-tight line-clamp-1 flex-1">
                          {ad.adContent?.headline || '—'}
                        </h4>
                        <span className="text-[9px] opacity-30 font-mono shrink-0">
                          #{(ad._id || '000000').slice(-4)}
                        </span>
                      </div>
                      <p className="text-xs opacity-50 mt-0.5 line-clamp-1">
                        {ad.advertiser?.name || 'Unknown'} · {ad.placement?.slot?.replace('_', ' ')}
                      </p>
                    </div>

                    {/* Mini analytics row */}
                    <div className="flex gap-3 text-[10px] font-mono font-bold">
                      <span className="flex items-center gap-1 opacity-50"><Eye size={10}/> {(ad.analytics?.views ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1 opacity-50"><MousePointer2 size={10}/> {(ad.analytics?.clicks ?? 0).toLocaleString()}</span>
                      <span className="flex items-center gap-1 text-primary ml-auto"><TrendingUp size={10}/> {ctr}%</span>
                    </div>

                    {/* Budget bar */}
                    <div className="space-y-1.5">
                      <BudgetBar
                        current={ad.budget?.currentSpend ?? 0}
                        total={ad.budget?.totalMax ?? 1}
                        status={ad.status}
                      />
                      <div className="flex justify-between text-[10px] font-mono opacity-40">
                        <span>₹{(ad.budget?.currentSpend ?? 0).toLocaleString()} spent</span>
                        <span>₹{(ad.budget?.totalMax ?? 0).toLocaleString()} cap</span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex justify-between items-center pt-2 border-t border-base-300 mt-auto">
                      <div>
                        <p className="text-[9px] opacity-30 uppercase font-bold">Model</p>
                        <p className="text-xs font-black text-primary">{ad.pricingModel}</p>
                      </div>
                      <div className="flex gap-1">
                        <button
                          onClick={(e) => { e.stopPropagation(); openEdit(ad); }}
                          className="p-2 rounded-xl hover:bg-primary/10 transition-all"
                        >
                          <Edit3 size={16} className="text-primary" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); dispatch(archiveAd(ad._id)); }}
                          className="p-2 rounded-xl hover:bg-error/10 transition-all"
                        >
                          <Trash2 size={16} className="text-error" />
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* ── DETAIL OVERLAY ─────────────────────────────────────────────── */}
      <AnimatePresence>
        {selectedAd && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-base-content/20 backdrop-blur-2xl p-4"
            onClick={() => setSelectedAd(null)}
          >
            <motion.div
              initial={{ scale: 0.94, y: 30 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 30 }}
              className="w-full max-w-6xl glass-card overflow-hidden shadow-2xl flex flex-col md:flex-row h-[88vh]"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Left — media */}
              <div className="md:w-3/5 bg-black flex items-center justify-center relative overflow-hidden">
                {selectedAd.adContent?.mediaUrl ? (
                  selectedAd.adContent.mediaType === 'Video' ? (
                    <video
                      src={selectedAd.adContent.mediaUrl}
                      className="max-w-full max-h-full object-contain"
                      controls
                    />
                  ) : (
                    <img
                      src={selectedAd.adContent.mediaUrl}
                      className="max-w-full max-h-full object-contain"
                      alt="ad-full"
                    />
                  )
                ) : (
                  <div className="text-white/10 flex flex-col items-center gap-3">
                    <Layers size={56} strokeWidth={1} />
                    <p className="text-xs uppercase tracking-widest">No media</p>
                  </div>
                )}

                {/* Landing page strip */}
                <div className="absolute bottom-4 left-4 right-4 p-3 rounded-xl bg-black/60 backdrop-blur text-white">
                  <p className="text-[9px] opacity-50 uppercase mb-0.5">Landing Page</p>
                  <p className="text-xs font-mono truncate">{selectedAd.adContent?.landingPageUrl || '—'}</p>
                </div>
              </div>

              {/* Right — details */}
              <div className="md:w-2/5 flex flex-col bg-base-100 overflow-y-auto scrollbar-hide">
                <div className="p-8 border-b border-base-300">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <StatBadge status={selectedAd.status} />
                        <span className="text-[10px] font-bold opacity-30 uppercase tracking-widest">
                          {selectedAd.advertiser?.type}
                        </span>
                      </div>
                      <h2 className="text-2xl font-black leading-tight">{selectedAd.adContent?.headline}</h2>
                      <p className="text-sm opacity-50 mt-1">{selectedAd.adContent?.subHeadline}</p>
                    </div>
                    <button
                      onClick={() => setSelectedAd(null)}
                      className="p-2 hover:bg-base-200 rounded-full transition-all hover:rotate-90 shrink-0"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  {/* CTA preview */}
                  <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold">
                    <MousePointerClick size={14} />
                    {selectedAd.adContent?.ctaText || 'Learn More'}
                    <ChevronRight size={12} />
                  </div>
                </div>

                <div className="p-8 space-y-8 flex-1">
                  {/* Placement */}
                  <div>
                    <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3">Placement</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Page',     value: selectedAd.placement?.page?.replace('_', ' ') },
                        { label: 'Slot',     value: selectedAd.placement?.slot?.replace('_', ' ') },
                        { label: 'Priority', value: `P${selectedAd.placement?.priority}` },
                      ].map((item) => (
                        <div key={item.label} className="p-3 bg-base-200 rounded-xl text-center">
                          <p className="text-[9px] opacity-40 uppercase mb-1">{item.label}</p>
                          <p className="text-xs font-black">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Targeting */}
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3 flex items-center gap-1.5"><MapPin size={11}/> Targeting</p>
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-50">Devices</span>
                          <b>{(selectedAd.targeting?.deviceType ?? []).join(', ') || '—'}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-50">Radius</span>
                          <b>{selectedAd.targeting?.radiusInKm ?? 0} km</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-50">Coords</span>
                          <b className="font-mono text-[10px]">
                            {(selectedAd.targeting?.location?.coordinates ?? [0, 0]).map((c) => c.toFixed(2)).join(', ')}
                          </b>
                        </div>
                      </div>
                      {(selectedAd.targeting?.userSegments?.length ?? 0) > 0 && (
                        <div className="mt-3 flex flex-wrap gap-1">
                          {selectedAd.targeting.userSegments.map((seg) => (
                            <span key={seg} className="px-2 py-0.5 bg-primary/10 text-primary text-[9px] rounded-full font-bold">{seg}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3 flex items-center gap-1.5"><Clock size={11}/> Schedule</p>
                      <div className="text-xs space-y-2">
                        <div className="flex justify-between">
                          <span className="opacity-50">Start</span>
                          <b>{selectedAd.schedule?.startDate ? new Date(selectedAd.schedule.startDate).toLocaleDateString() : '—'}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-50">End</span>
                          <b>{selectedAd.schedule?.endDate ? new Date(selectedAd.schedule.endDate).toLocaleDateString() : 'Open'}</b>
                        </div>
                        <div className="flex justify-between">
                          <span className="opacity-50">Freq Cap</span>
                          <b>{selectedAd.schedule?.frequencyCap?.limit} / {selectedAd.schedule?.frequencyCap?.windowHours}h</b>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Analytics */}
                  <div>
                    <p className="text-[10px] font-black opacity-30 uppercase tracking-widest mb-3 flex items-center gap-1.5"><BarChart3 size={11}/> Performance</p>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { label: 'Views',       value: (selectedAd.analytics?.views ?? 0).toLocaleString() },
                        { label: 'Clicks',      value: (selectedAd.analytics?.clicks ?? 0).toLocaleString() },
                        { label: 'Conversions', value: (selectedAd.analytics?.conversions ?? 0).toLocaleString() },
                      ].map((item) => (
                        <div key={item.label} className="p-3 bg-base-200 rounded-xl text-center">
                          <p className="text-[9px] opacity-40 uppercase mb-1">{item.label}</p>
                          <p className="text-sm font-black font-mono">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Budget */}
                  <div className="p-5 bg-base-200 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold opacity-40 uppercase tracking-widest">Budget Utilisation</span>
                      <span className="font-mono font-black text-sm text-primary">
                        ₹{(selectedAd.budget?.currentSpend ?? 0).toLocaleString()}
                        <span className="text-xs opacity-30"> / ₹{(selectedAd.budget?.totalMax ?? 0).toLocaleString()}</span>
                      </span>
                    </div>
                    <BudgetBar
                      current={selectedAd.budget?.currentSpend ?? 0}
                      total={selectedAd.budget?.totalMax ?? 1}
                      status={selectedAd.status}
                    />
                    <div className="flex justify-between text-[10px] opacity-30 font-mono">
                      <span>Daily cap: ₹{(selectedAd.budget?.dailyMax ?? 0).toLocaleString()}</span>
                      <span>Model: {selectedAd.pricingModel}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 border-t border-base-300">
                  <button
                    onClick={() => { setSelectedAd(null); openEdit(selectedAd); }}
                    className="btn-primary-cta w-full py-3 flex items-center justify-center gap-2"
                  >
                    <Edit3 size={16} /> Edit Advertisement
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── CREATE / EDIT SIDEBAR ───────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[105] bg-base-content/10 backdrop-blur-sm"
              onClick={() => setIsSidebarOpen(false)}
            />

            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 300 }}
              className="fixed inset-y-0 right-0 z-[110] w-full max-w-2xl flex flex-col bg-base-100 border-l border-base-300 shadow-[0_0_80px_rgba(0,0,0,0.25)]"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-8 py-6 border-b border-base-300 bg-base-200/40 shrink-0">
                <div>
                  <h2 className="text-2xl font-black">{isEditMode ? 'Update' : 'New'} Advertisement</h2>
                  <p className="text-[10px] opacity-40 uppercase tracking-widest mt-0.5">
                    Configure placement · targeting · economics
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSidebarOpen(false)}
                  className="p-2 rounded-full hover:bg-base-300 transition-all"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable form body */}
              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto custom-scrollbar">
                <div className="p-8 space-y-14 pb-36">

                  {/* ── § 1  META & LIFECYCLE ─────────────────────────────── */}
                  <section>
                    <SectionHeading icon={ShieldCheck}>1. Meta &amp; Lifecycle</SectionHeading>
                    <div className="grid grid-cols-2 gap-5 mb-5">
                      <Field label="Advertiser Name">
                        <input
                          required
                          placeholder="Apple, Nike…"
                          className="input-field w-full"
                          value={formData.advertiser.name}
                          onChange={(e) => set('advertiser.name', e.target.value)}
                        />
                      </Field>
                      <Field label="Partner Type">
                        <select
                          className="input-field w-full"
                          value={formData.advertiser.type}
                          onChange={(e) => set('advertiser.type', e.target.value)}
                        >
                          <option value="Internal">Internal</option>
                          <option value="External_Partner">External Partner</option>
                        </select>
                      </Field>
                    </div>
                    <Field label="Lifecycle Status">
                      <div className="grid grid-cols-5 gap-2">
                        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                          const Icon = cfg.icon;
                          const active = formData.status === key;
                          return (
                            <button
                              type="button"
                              key={key}
                              onClick={() => set('status', key)}
                              className={`p-2.5 rounded-xl border text-[10px] font-bold uppercase tracking-wide flex flex-col items-center gap-1 transition-all ${
                                active ? 'border-transparent shadow-inner' : 'border-base-300 opacity-50 hover:opacity-80'
                              }`}
                              style={active ? { background: cfg.bg, color: cfg.color, borderColor: cfg.color + '40' } : {}}
                            >
                              <Icon size={14} />
                              {key}
                            </button>
                          );
                        })}
                      </div>
                    </Field>
                  </section>

                  {/* ── § 2  CREATIVE CONTENT ────────────────────────────── */}
                  <section>
                    <SectionHeading icon={Layers}>2. Creative Content</SectionHeading>

                    {/* Media preview */}
                    <AnimatePresence>
                      {formData.adContent.mediaUrl && (
                        <motion.div
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          className="relative w-full aspect-video rounded-2xl overflow-hidden bg-base-200 mb-5 group"
                        >
                          {formData.adContent.mediaType === 'Video' ? (
                            <video src={formData.adContent.mediaUrl} className="w-full h-full object-contain" controls />
                          ) : (
                            <img src={formData.adContent.mediaUrl} alt="Preview" className="w-full h-full object-contain" />
                          )}
                          <button
                            type="button"
                            onClick={() => set('adContent.mediaUrl', '')}
                            className="absolute top-3 right-3 p-1.5 bg-error text-white rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <div className="space-y-4">
                      <Field label="Headline">
                        <div className="relative">
                          <Type size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                          <input
                            required
                            placeholder="Main catchy headline"
                            className="input-field w-full pl-9"
                            value={formData.adContent.headline}
                            onChange={(e) => set('adContent.headline', e.target.value)}
                          />
                        </div>
                      </Field>

                      <Field label="Sub-Headline">
                        <textarea
                          rows={3}
                          placeholder="Supporting description…"
                          className="input-field w-full py-3 resize-none"
                          value={formData.adContent.subHeadline}
                          onChange={(e) => set('adContent.subHeadline', e.target.value)}
                        />
                      </Field>

                      <div className="grid grid-cols-[1fr_auto] gap-3">
                        <Field label="Media URL">
                          <input
                            placeholder="https://cdn.example.com/ad.jpg"
                            className="input-field w-full text-xs"
                            value={formData.adContent.mediaUrl}
                            onChange={(e) => set('adContent.mediaUrl', e.target.value)}
                          />
                        </Field>
                        <Field label="Upload">
                          <label className="flex items-center justify-center h-[42px] px-4 bg-primary/10 text-primary rounded-xl cursor-pointer hover:bg-primary hover:text-white transition-all">
                            {isUploading
                              ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                              : <Upload size={18} />
                            }
                            <input
                              type="file"
                              hidden
                              accept="image/*,video/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) dispatch(uploadSingleFile({ file, folder: 'ads' }));
                              }}
                            />
                          </label>
                        </Field>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        <Field label="Media Type">
                          <select
                            className="input-field w-full"
                            value={formData.adContent.mediaType}
                            onChange={(e) => set('adContent.mediaType', e.target.value)}
                          >
                            <option value="Image">Image</option>
                            <option value="Video">Video</option>
                            <option value="Gif">GIF</option>
                          </select>
                        </Field>
                        <Field label="CTA Button Text">
                          <div className="relative">
                            <MousePointerClick size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                            <input
                              placeholder="Shop Now"
                              className="input-field w-full pl-9"
                              value={formData.adContent.ctaText}
                              onChange={(e) => set('adContent.ctaText', e.target.value)}
                            />
                          </div>
                        </Field>
                      </div>

                      <Field label="Landing Page URL">
                        <div className="relative">
                          <LinkIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                          <input
                            required
                            placeholder="https://…"
                            className="input-field w-full pl-9"
                            value={formData.adContent.landingPageUrl}
                            onChange={(e) => set('adContent.landingPageUrl', e.target.value)}
                          />
                        </div>
                      </Field>
                    </div>
                  </section>

                  {/* ── § 3  PLACEMENT & TARGETING ───────────────────────── */}
                  <section>
                    <SectionHeading icon={Target}>3. Placement &amp; Targeting</SectionHeading>
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <Field label="Page">
                        <select
                          className="input-field w-full text-xs"
                          value={formData.placement.page}
                          onChange={(e) => set('placement.page', e.target.value)}
                        >
                          <option value="Global">Global</option>
                          <option value="Search_Results">Search Results</option>
                          <option value="Medicine_Store">Medicine Store</option>
                          <option value="Ride_Tracking_Screen">Ride Tracking</option>
                        </select>
                      </Field>
                      <Field label="Slot">
                        <select
                          className="input-field w-full text-xs"
                          value={formData.placement.slot}
                          onChange={(e) => set('placement.slot', e.target.value)}
                        >
                          <option value="Native_Feed">Native Feed</option>
                          <option value="Popup">Popup</option>
                          <option value="Sticky_Bottom">Sticky Bottom</option>
                          <option value="Hero_Banner">Hero Banner</option>
                        </select>
                      </Field>
                      <Field label="Priority (1–10)">
                        <input
                          type="number"
                          min={1} max={10}
                          className="input-field w-full"
                          value={formData.placement.priority}
                          onChange={(e) => set('placement.priority', Number(e.target.value))}
                        />
                      </Field>
                    </div>

                    {/* Geo */}
                    <div className="grid grid-cols-3 gap-4 mb-5">
                      <Field label="Latitude">
                        <input
                          type="number" step="any" placeholder="17.385"
                          className="input-field w-full"
                          value={formData.targeting.location.coordinates[0]}
                          onChange={(e) =>
                            set('targeting.location.coordinates', [
                              Number(e.target.value),
                              formData.targeting.location.coordinates[1],
                            ])
                          }
                        />
                      </Field>
                      <Field label="Longitude">
                        <input
                          type="number" step="any" placeholder="78.486"
                          className="input-field w-full"
                          value={formData.targeting.location.coordinates[1]}
                          onChange={(e) =>
                            set('targeting.location.coordinates', [
                              formData.targeting.location.coordinates[0],
                              Number(e.target.value),
                            ])
                          }
                        />
                      </Field>
                      <Field label="Radius (km)">
                        <input
                          type="number"
                          className="input-field w-full"
                          value={formData.targeting.radiusInKm}
                          onChange={(e) => set('targeting.radiusInKm', Number(e.target.value))}
                        />
                      </Field>
                    </div>

                    {/* Device targeting */}
                    <div className="p-4 bg-base-200 rounded-2xl mb-5">
                      <Label>Device Targeting</Label>
                      <div className="flex gap-5 mt-2">
                        {[
                          { id: 'Web',     icon: Monitor },
                          { id: 'iOS',     icon: Smartphone },
                          { id: 'Android', icon: Zap },
                        ].map(({ id, icon: Icon }) => (
                          <label key={id} className="flex items-center gap-2 cursor-pointer group">
                            <input
                              type="checkbox"
                              className="w-4 h-4 accent-primary"
                              checked={formData.targeting.deviceType.includes(id)}
                              onChange={(e) => toggleDevice(id, e.target.checked)}
                            />
                            <Icon size={13} className="opacity-40 group-hover:opacity-100 transition-opacity" />
                            <span className="text-sm font-bold opacity-60 group-hover:opacity-100 transition-opacity">{id}</span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* User segments */}
                    <div className="p-4 bg-base-200 rounded-2xl">
                      <Label>User Segments</Label>
                      <div className="flex gap-2 mt-2 mb-3">
                        <div className="relative flex-1">
                          <Tag size={13} className="absolute left-3 top-1/2 -translate-y-1/2 opacity-30" />
                          <input
                            placeholder="e.g. frequent_buyers"
                            className="input-field w-full pl-9 text-xs"
                            value={segmentInput}
                            onChange={(e) => setSegmentInput(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addSegment(); } }}
                          />
                        </div>
                        <button
                          type="button"
                          onClick={addSegment}
                          className="px-4 py-2 bg-primary/10 text-primary rounded-xl text-xs font-bold hover:bg-primary hover:text-white transition-all"
                        >
                          Add
                        </button>
                      </div>
                      {formData.targeting.userSegments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5">
                          {formData.targeting.userSegments.map((seg) => (
                            <span
                              key={seg}
                              className="inline-flex items-center gap-1 px-2.5 py-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full"
                            >
                              {seg}
                              <button type="button" onClick={() => removeSegment(seg)} className="opacity-50 hover:opacity-100">
                                <X size={10} />
                              </button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </section>

                  {/* ── § 4  DELIVERY SCHEDULE ───────────────────────────── */}
                  <section>
                    <SectionHeading icon={Calendar}>4. Delivery Schedule</SectionHeading>
                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <Field label="Start Date">
                        <input
                          type="date"
                          className="input-field w-full"
                          value={formData.schedule.startDate}
                          onChange={(e) => set('schedule.startDate', e.target.value)}
                        />
                      </Field>
                      <Field label="End Date (optional)">
                        <input
                          type="date"
                          className="input-field w-full"
                          value={formData.schedule.endDate}
                          onChange={(e) => set('schedule.endDate', e.target.value)}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <Field label="Frequency Cap (limit)">
                        <input
                          type="number" min={1}
                          className="input-field w-full"
                          value={formData.schedule.frequencyCap.limit}
                          onChange={(e) => set('schedule.frequencyCap.limit', Number(e.target.value))}
                        />
                      </Field>
                      <Field label="Window (hours)">
                        <input
                          type="number" min={1}
                          className="input-field w-full"
                          value={formData.schedule.frequencyCap.windowHours}
                          onChange={(e) => set('schedule.frequencyCap.windowHours', Number(e.target.value))}
                        />
                      </Field>
                    </div>

                    <div className="p-4 bg-base-200 rounded-2xl">
                      <Label>Display Hours (0–23, click to toggle)</Label>
                      <div className="mt-3">
                        <HoursGrid
                          value={formData.schedule.displayHours}
                          onChange={(v) => set('schedule.displayHours', v)}
                        />
                      </div>
                      {formData.schedule.displayHours.length > 0 && (
                        <p className="text-[10px] mt-2 opacity-40 font-mono">
                          Active: {[...formData.schedule.displayHours].sort((a, b) => a - b).join(', ')}h
                        </p>
                      )}
                    </div>
                  </section>

                  {/* ── § 5  ECONOMICS ───────────────────────────────────── */}
                  <section>
                    <SectionHeading icon={DollarSign}>5. Economics &amp; Budgeting</SectionHeading>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <Field label="Pricing Model">
                        <select
                          className="input-field w-full"
                          value={formData.pricingModel}
                          onChange={(e) => set('pricingModel', e.target.value)}
                        >
                          <option value="CPC">CPC — Per Click</option>
                          <option value="CPM">CPM — Per 1k Views</option>
                          <option value="CPA">CPA — Per Action</option>
                          <option value="Fixed_Weekly">Fixed Weekly</option>
                        </select>
                      </Field>
                      <Field label="Total Budget Cap (₹)">
                        <input
                          required
                          type="number" min={0}
                          className="input-field w-full font-mono"
                          value={formData.budget.totalMax}
                          onChange={(e) => set('budget.totalMax', Number(e.target.value))}
                        />
                      </Field>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-5">
                      <Field label="Daily Spend Cap (₹)">
                        <input
                          type="number" min={0}
                          className="input-field w-full font-mono"
                          value={formData.budget.dailyMax}
                          onChange={(e) => set('budget.dailyMax', Number(e.target.value))}
                        />
                      </Field>
                      <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl flex flex-col justify-center">
                        <p className="text-[9px] opacity-40 uppercase tracking-widest font-bold">Current Spend</p>
                        <p className="text-xl font-black font-mono text-primary mt-0.5">
                          ₹{(formData.budget.currentSpend ?? 0).toLocaleString()}
                        </p>
                      </div>
                    </div>

                    {/* Live budget bar preview */}
                    {formData.budget.totalMax > 0 && (
                      <div className="p-4 bg-base-200 rounded-2xl space-y-2">
                        <div className="flex justify-between text-[10px] opacity-50 font-mono">
                          <span>₹{formData.budget.currentSpend.toLocaleString()} spent</span>
                          <span>₹{formData.budget.totalMax.toLocaleString()} cap</span>
                        </div>
                        <BudgetBar
                          current={formData.budget.currentSpend}
                          total={formData.budget.totalMax}
                          status={formData.status}
                        />
                      </div>
                    )}
                  </section>

                </div>{/* /form body */}

                {/* Fixed footer CTA */}
                <div className="sticky bottom-0 px-8 py-5 bg-base-100/95 backdrop-blur-md border-t border-base-300 flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsSidebarOpen(false)}
                    className="px-6 py-3 rounded-xl border border-base-300 text-sm font-bold hover:bg-base-200 transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isUploading || loading}
                    className="btn-primary-cta flex-1 py-3 text-base flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading
                      ? <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      : isEditMode ? <><Edit3 size={16}/> Update Advertisement</> : <><Plus size={16}/> Deploy Advertisement</>
                    }
                  </button>
                </div>
              </form>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AdvertisementManagement;