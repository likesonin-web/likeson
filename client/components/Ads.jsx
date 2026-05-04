"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  fetchActiveBanners,
  trackAdActivity,
} from '@/store/slices/adsSlice';
import {
  ExternalLink, X, ChevronLeft, ChevronRight,
  MapPin, Zap, Navigation, ArrowRight,
  Globe, HeartPulse, ShieldCheck, Volume2, VolumeX
} from 'lucide-react';
import Container from './ui/Container';

// ─── Helpers ────────────────────────────────────────────────────────────────

const useAdInteraction = (dispatch) => {
  const handleView = useCallback((id) => {
    dispatch(trackAdActivity({ id, type: 'view' }));
  }, [dispatch]);

  const handleClick = useCallback((ad) => {
    dispatch(trackAdActivity({ id: ad._id, type: 'click' }));
    if (ad.adContent?.landingPageUrl) {
      window.open(ad.adContent.landingPageUrl, '_blank', 'noopener,noreferrer');
    }
  }, [dispatch]);

  return { handleView, handleClick };
};

const useViewTracking = (adId, onView) => {
  const ref = useRef(null);
  const fired = useRef(false);

  // FIX: Reset fired when adId changes so new ad gets view tracked
  useEffect(() => {
    fired.current = false;
  }, [adId]);

  useEffect(() => {
    if (!adId || !ref.current) return;
    const obs = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !fired.current) {
        fired.current = true;
        onView(adId);
        obs.disconnect();
      }
    }, { threshold: 0.5 });
    obs.observe(ref.current);
    return () => obs.disconnect();
  }, [adId, onView]);
  return ref;
};

const AdMedia = ({ ad, className = "" }) => {
  const [isMuted, setIsMuted] = useState(true);
  const { mediaUrl, mediaType, headline } = ad.adContent || {};

  if (!mediaUrl) return null;

  if (mediaType === 'Video') {
    return (
      <div className="relative w-full h-full group/media overflow-hidden">
        <video
          src={mediaUrl}
          className={`${className} bg-black w-full h-full object-cover`}
          autoPlay
          muted={isMuted}
          loop
          playsInline
        />
        <button
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="absolute bottom-3 right-3 p-2 bg-black/60 text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-opacity z-20"
        >
          {isMuted ? <VolumeX size={14} /> : <Volume2 size={14} />}
        </button>
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={headline}
      className={`${className} object-cover w-full h-full`}
      loading="lazy"
    />
  );
};

const AnimatedContent = ({ children, delay = 0.2 }) => (
  <motion.div
    initial={{ opacity: 0.1, y: 10 }}
    whileInView={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.6, delay, ease: "easeOut" }}
  >
    {children}
  </motion.div>
);

// ─── Slot Components ────────────────────────────────────────────────────────

const GlobalAd = ({ ads, slot, onView, onClick }) => {
  const [idx, setIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(true);
  const ad = ads[idx];
  const ref = useViewTracking(ad?._id, onView);

  if (!ad || !isOpen) return null;

  // 1. POPUP LAYOUT
  if (slot === 'Popup') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
        >
          <motion.div
            initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            className="relative w-full max-w-4xl bg-base-100 rounded-box overflow-hidden shadow-2xl border border-base-300 flex flex-col md:flex-row h-auto md:h-[500px]"
          >
            <button
              onClick={() => setIsOpen(false)}
              className="absolute top-4 right-4 z-50 p-2 bg-black/20 hover:bg-black/40 rounded-full text-base-content transition-colors"
            >
              <X size={20} />
            </button>

            <div className="w-full md:w-1/2 h-64 md:h-full relative">
              <AdMedia ad={ad} className="w-full h-full" />
            </div>

            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-base-100 text-base-content">
              <AnimatedContent>
                <div className="flex items-center gap-2 mb-4">
                  <div className="w-8 h-8 rounded bg-primary/10 flex items-center justify-center text-primary font-bold">
                    {ad.advertiser.name.charAt(0)}
                  </div>
                  <span className="text-xs font-black uppercase tracking-widest opacity-60">{ad.advertiser.name}</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-black leading-tight mb-4">{ad.adContent.headline}</h2>
                <p className="text-base-content/60 text-sm mb-8 leading-relaxed">{ad.adContent.subHeadline}</p>
                <button
                  onClick={() => onClick(ad)}
                  className="btn-primary-cta w-full py-4 flex items-center justify-center gap-2 group"
                >
                  {ad.adContent.ctaText} <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </AnimatedContent>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // 2. HERO BANNER LAYOUT
  if (slot === 'Hero_Banner') {
    return (
      <div ref={ref} className="relative w-full min-h-[350px] rounded-box overflow-hidden border border-base-300 bg-base-200">
        <AdMedia ad={ad} className="absolute inset-0 w-full h-full" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/40 to-transparent" />
        <div className="relative z-10 p-10 flex flex-col justify-center h-full min-h-[350px] max-w-xl">
          <AnimatedContent>
            <span className="badge badge-primary mb-4">Featured Partner</span>
            <h2 className="text-4xl font-black text-white mb-4 leading-tight">{ad.adContent.headline}</h2>
            <p className="text-white/70 text-sm mb-8">{ad.adContent.subHeadline}</p>
            <button onClick={() => onClick(ad)} className="btn-primary-cta w-fit px-8">
              {ad.adContent.ctaText}
            </button>
          </AnimatedContent>
        </div>
      </div>
    );
  }

  // 3. NATIVE FEED (Default)
  return (
    <div ref={ref} onClick={() => onClick(ad)} className="glass-card p-4 flex gap-4 cursor-pointer group hover:bg-base-200/50">
      <div className="w-24 h-24 rounded-field overflow-hidden shrink-0 border border-base-300">
        <AdMedia ad={ad} className="w-full h-full transition-transform duration-500 group-hover:scale-110" />
      </div>
      <div className="flex flex-col justify-center min-w-0">
        <AnimatedContent>
          <p className="text-[10px] font-bold text-primary uppercase tracking-tighter mb-1">{ad.advertiser.name} • Sponsored</p>
          <h4 className="font-black text-base-content leading-tight truncate">{ad.adContent.headline}</h4>
          <p className="text-xs text-base-content/60 line-clamp-2 mt-1">{ad.adContent.subHeadline}</p>
        </AnimatedContent>
      </div>
    </div>
  );
};

const MedicineStoreAd = ({ ads, slot, onView, onClick }) => {
  const ad = ads[0];
  const ref = useViewTracking(ad?._id, onView);
  if (!ad) return null;

  return (
    <div ref={ref} onClick={() => onClick(ad)} className="bg-base-100 border-2 border-success/20 rounded-box p-4 flex items-center gap-4 hover:border-success transition-all cursor-pointer shadow-sm group">
      <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-success/5">
        <AdMedia ad={ad} className="w-full h-full group-hover:scale-110 transition-transform" />
      </div>
      <div className="flex-1">
        <AnimatedContent>
          <div className="flex items-center gap-1 text-success text-[10px] font-black uppercase">
            <ShieldCheck size={12} /> Verified Care
          </div>
          <h4 className="font-black text-base-content uppercase tracking-tight line-clamp-1">{ad.adContent.headline}</h4>
          <p className="text-[10px] opacity-50 font-bold">{ad.adContent.ctaText}</p>
        </AnimatedContent>
      </div>
      <ArrowRight size={16} className="text-success opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all" />
    </div>
  );
};

const RideTrackingAd = ({ ads, slot, onView, onClick }) => {
  const ad = ads[0];
  const [dismissed, setDismissed] = useState(false);
  const ref = useViewTracking(ad?._id, onView);
  if (!ad || dismissed) return null;

  return (
    <motion.div ref={ref} initial={{ y: 100 }} animate={{ y: 0 }} className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-96 z-[999]">
      <div className="bg-neutral text-neutral-content p-5 rounded-box shadow-2xl flex flex-col gap-4 border border-white/10 relative overflow-hidden">
        <button onClick={() => setDismissed(true)} className="absolute top-2 right-2 p-1 text-white/30 hover:text-white"><X size={16} /></button>
        <div className="flex items-center gap-3">
          <div className="w-14 h-14 rounded-field overflow-hidden bg-white/10 shrink-0">
            <AdMedia ad={ad} className="w-full h-full" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-primary animate-pulse" />
              <p className="text-[9px] font-mono uppercase tracking-widest opacity-50">Discovery_Ad</p>
            </div>
            <h5 className="font-black text-sm truncate uppercase">{ad.adContent.headline}</h5>
          </div>
        </div>
        <button onClick={() => onClick(ad)} className="btn-primary-cta py-3 text-xs w-full shadow-primary">
          {ad.adContent.ctaText} <Zap size={14} className="ml-2 fill-current" />
        </button>
      </div>
    </motion.div>
  );
};

const SearchResultsAd = ({ ads, slot, onView, onClick }) => {
  const ad = ads[0];
  const ref = useViewTracking(ad?._id, onView);
  if (!ad) return null;

  return (
    <div ref={ref} onClick={() => onClick(ad)} className="border-b border-base-300 py-8 group cursor-pointer">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-field bg-base-200 flex items-center justify-center text-xs font-black text-primary border border-base-300">
          {ad.advertiser.name.charAt(0)}
        </div>
        <div>
          <span className="text-xs font-black text-base-content block leading-none">{ad.advertiser.name}</span>
          <span className="text-[9px] opacity-40 font-bold uppercase tracking-tighter">Verified Partner</span>
        </div>
      </div>
      <h3 className="text-2xl font-black text-primary group-hover:text-primary/80 transition-colors mb-2 leading-tight">
        {ad.adContent.headline}
      </h3>
      <p className="text-sm text-base-content/70 mb-6 max-w-2xl">{ad.adContent.subHeadline}</p>
      {ad.adContent.mediaUrl && (
        <div className="w-full max-w-2xl aspect-video rounded-box overflow-hidden border border-base-300 bg-base-200">
          <AdMedia ad={ad} className="group-hover:scale-[1.02] transition-transform duration-700" />
        </div>
      )}
    </div>
  );
};

// ─── Page → Component Map ────────────────────────────────────────────────────
// FIX: Global ads (Popup, Hero_Banner, Native_Feed) can appear on any page.
// Backend already filters by page+slot. We trust server response directly —
// no re-filtering by page/slot on client (was causing ads to vanish).

const PAGE_COMPONENT_MAP = {
  Global: GlobalAd,
  Medicine_Store: MedicineStoreAd,
  Ride_Tracking_Screen: RideTrackingAd,
  Search_Results: SearchResultsAd,
};

// ─── Main Component ─────────────────────────────────────────────────────────

const ADS = ({ page, slot, className = "" }) => {
  const dispatch = useDispatch();

  // FIX: Read from bannersByKey map using page_slot key, not flat activeBanners array.
  // This prevents multiple ADS instances from clobbering each other's data.
  const bannerKey = `${page}_${slot}`;
  const bannersByKey = useSelector((s) => s.ads.bannersByKey);
  const isRefreshing = useSelector((s) => s.ads.isRefreshing);

  // FIX: ads for THIS specific page+slot
  const ads = useMemo(() => bannersByKey?.[bannerKey] ?? [], [bannersByKey, bannerKey]);

  const { handleView, handleClick } = useAdInteraction(dispatch);

  useEffect(() => {
    dispatch(fetchActiveBanners({ page, slot }));
  }, [dispatch, page, slot]);

  // FIX: Sort by priority client-side (server already sorts, this is a safety net)
  const sortedAds = useMemo(() => {
    return [...ads].sort((a, b) => {
      if (b.placement.priority !== a.placement.priority) {
        return b.placement.priority - a.placement.priority;
      }
      const mediaOrder = { Image: 0, Video: 1, Gif: 2 };
      return (mediaOrder[a.adContent.mediaType] ?? 0) - (mediaOrder[b.adContent.mediaType] ?? 0);
    });
  }, [ads]);

  if (isRefreshing && sortedAds.length === 0) {
    return (
      <div
        className={`w-full animate-pulse bg-base-300 rounded-box ${className}`}
        style={{ height: slot === 'Hero_Banner' ? '350px' : '120px' }}
      />
    );
  }

  if (!sortedAds.length) return null;

  // FIX: Determine which component to render.
  // Global page ads use GlobalAd regardless of which page they appear on.
  // For non-Global pages, use the page-specific component.
  // Backend already matched page+slot — just render what came back.
  const adPage = sortedAds[0]?.placement?.page ?? page;
  const AdComponent = PAGE_COMPONENT_MAP[adPage] ?? GlobalAd;

  const props = { ads: sortedAds, slot, onView: handleView, onClick: handleClick };

  return (
    <div className={`w-full h-auto ${className}`}>
      <Container >
      <AdComponent {...props} />
      </Container>
    </div>
  );
};

export default ADS;