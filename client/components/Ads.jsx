"use client";

import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchActiveBanners, trackAdActivity } from '@/store/slices/adsSlice';
import { 
  X, Zap, ArrowRight, ShieldCheck, 
  Volume2, VolumeX, ExternalLink, Info
} from 'lucide-react';
import Container from './ui/Container'; // Adjust path if necessary

// ─────────────────────────────────────────────────────────────────────────────
// 1. CUSTOM HOOKS (Optimized for Zero-Looping & Memory Leaks)
// ─────────────────────────────────────────────────────────────────────────────

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
  const hasFired = useRef(false);

  // Reset tracking flag strictly when ad ID changes
  useEffect(() => {
    hasFired.current = false;
  }, [adId]);

  useEffect(() => {
    const node = ref.current;
    if (!adId || !node) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasFired.current) {
          hasFired.current = true;
          onView(adId);
          observer.disconnect(); // Prevent redundant fires
        }
      },
      { threshold: 0.5 } // 50% visibility required for a view
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [adId, onView]);

  return ref;
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. REUSABLE UI COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const AdMedia = ({ ad, className = "" }) => {
  const [isMuted, setIsMuted] = useState(true);
  const { mediaUrl, mediaType, headline } = ad.adContent || {};

  if (!mediaUrl) return <div className={`bg-base-300 skeleton ${className}`} />;

  if (mediaType === 'Video') {
    return (
      <div className={`relative w-full h-full group/media overflow-hidden ${className}`}>
        <video
          src={mediaUrl}
          className="w-full h-full object-cover bg-black"
          autoPlay
          muted={isMuted}
          loop
          playsInline
        />
        <button
          onClick={(e) => { 
            e.stopPropagation(); 
            setIsMuted((prev) => !prev); 
          }}
          className="absolute bottom-3 right-3 p-2 bg-black/60 backdrop-blur-soft text-white rounded-full opacity-0 group-hover/media:opacity-100 transition-all duration-300 hover:scale-110 z-20"
          aria-label={isMuted ? "Unmute" : "Mute"}
        >
          {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
      </div>
    );
  }

  return (
    <img
      src={mediaUrl}
      alt={headline || "Advertisement"}
      className={`${className} object-cover w-full h-full transition-transform duration-700`}
      loading="lazy"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
};

const AnimatedContent = ({ children, delay = 0.1 }) => (
  <motion.div
    initial={{ opacity: 0, y: 15 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-50px" }}
    transition={{ duration: 0.5, delay, ease: [0.25, 0.1, 0.25, 1] }}
  >
    {children}
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. AD SLOT LAYOUTS (Themed via global.css tokens)
// ─────────────────────────────────────────────────────────────────────────────

const GlobalAd = ({ ads, slot, onView, onClick }) => {
  const [isOpen, setIsOpen] = useState(true);
  const ad = ads[0]; // Take top priority ad
  const ref = useViewTracking(ad?._id, onView);

  if (!ad || !isOpen) return null;

  // ── POPUP LAYOUT ──
  if (slot === 'Popup') {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0 }} 
          animate={{ opacity: 1 }} 
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9990] flex items-center justify-center p-4 bg-black/70 backdrop-blur-strong"
        >
          <motion.div
            initial={{ scale: 0.95, y: 20 }} 
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="card w-full relative max-w-4xl overflow-hidden flex flex-col md:flex-row h-auto md:h-[480px] shadow-primary"
          >
            <button
              onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
              className="absolute top-4 right-4 z-50 btn btn-circle btn-sm bg-black/40 text-white border-none hover:bg-black/60 backdrop-blur-md"
            >
              <X size={16} />
            </button>

            <div className="w-full md:w-1/2 h-64 md:h-full relative overflow-hidden">
              <AdMedia ad={ad} className="w-full h-full" />
              <div className="absolute top-4 left-4 badge badge-primary shadow-sm backdrop-blur-md bg-base-100/80">
                Sponsored
              </div>
            </div>

            <div className="w-full md:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-base-100">
              <AnimatedContent>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-field bg-primary/10 flex items-center justify-center text-primary font-black text-lg border border-primary/20">
                    {ad.advertiser.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-xs font-bold text-primary uppercase tracking-widest">{ad.advertiser.name}</p>
                    <p className="text-[10px] text-base-content/50">Verified Partner</p>
                  </div>
                </div>
                <h2 className="text-responsive-2xl font-black leading-tight mb-4 text-base-content">
                  {ad.adContent.headline}
                </h2>
                <p className="text-base-content/60 text-responsive-sm mb-8 leading-relaxed">
                  {ad.adContent.subHeadline}
                </p>
                <button
                  onClick={() => onClick(ad)}
                  className="btn-primary-cta w-full group flex justify-center items-center gap-2"
                >
                  {ad.adContent.ctaText} 
                  <ArrowRight size={18} className="group-hover:translate-x-1.5 transition-transform" />
                </button>
              </AnimatedContent>
            </div>
          </motion.div>
        </motion.div>
      </AnimatePresence>
    );
  }

  // ── HERO BANNER LAYOUT ──
  if (slot === 'Hero_Banner') {
    return (
      <div ref={ref} className="relative w-full min-h-[350px] md:min-h-[400px] rounded-box overflow-hidden border-primary/20 border shadow-sm group cursor-pointer" onClick={() => onClick(ad)}>
        <AdMedia ad={ad} className="absolute inset-0 w-full h-full group-hover:scale-105" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent" />
        <div className="relative z-10 p-8 md:p-12 flex flex-col justify-center h-full min-h-[350px] max-w-2xl">
          <AnimatedContent>
            <span className="badge badge-accent mb-4 border-none shadow-sm">Promoted Feature</span>
            <h2 className="text-responsive-2xl font-black text-white mb-4 leading-tight drop-shadow-md">
              {ad.adContent.headline}
            </h2>
            <p className="text-white/80 text-responsive-sm mb-8 max-w-xl drop-shadow-sm">
              {ad.adContent.subHeadline}
            </p>
            <button onClick={(e) => { e.stopPropagation(); onClick(ad); }} className="btn-primary-cta w-fit hover-glow-primary">
              {ad.adContent.ctaText}
            </button>
          </AnimatedContent>
        </div>
      </div>
    );
  }

  // ── NATIVE FEED (Default) ──
  return (
    <div ref={ref} onClick={() => onClick(ad)} className="glass-card p-4 flex flex-col sm:flex-row gap-5 cursor-pointer group hover-glow-primary">
      <div className="w-full sm:w-32 h-40 sm:h-32 rounded-field overflow-hidden shrink-0 border border-base-300 relative">
        <AdMedia ad={ad} className="w-full h-full group-hover:scale-110" />
        <div className="absolute top-2 left-2 badge badge-xs badge-ghost bg-black/50 text-white border-none backdrop-blur-md">Ad</div>
      </div>
      <div className="flex flex-col justify-center min-w-0 flex-1">
        <AnimatedContent>
          <div className="flex items-center justify-between mb-1">
            <p className="text-[10px] font-bold text-primary uppercase tracking-widest">{ad.advertiser.name}</p>
            <ExternalLink size={14} className="text-base-content/30 group-hover:text-primary transition-colors" />
          </div>
          <h4 className="font-black text-responsive-lg text-base-content leading-tight mb-2 line-clamp-2">
            {ad.adContent.headline}
          </h4>
          <p className="text-sm text-base-content/60 line-clamp-2 mb-3">
            {ad.adContent.subHeadline}
          </p>
          <span className="text-xs font-semibold text-primary group-hover:underline underline-offset-2">
            {ad.adContent.ctaText} &rarr;
          </span>
        </AnimatedContent>
      </div>
    </div>
  );
};

// ── ROLE-SPECIFIC / CONTEXTUAL ADS ──

const MedicineStoreAd = ({ ads, slot, onView, onClick }) => {
  const ad = ads[0];
  const ref = useViewTracking(ad?._id, onView);
  if (!ad) return null;

  return (
    <div ref={ref} onClick={() => onClick(ad)} className="card bg-success/5 border-success/30 p-4 flex items-center gap-4 hover:shadow-success cursor-pointer group transition-all">
      <div className="w-16 h-16 bg-base-100 rounded-full flex items-center justify-center overflow-hidden shrink-0 ring-4 ring-success/20 group-hover:ring-success/40 transition-all">
        <AdMedia ad={ad} className="w-full h-full group-hover:scale-110" />
      </div>
      <div className="flex-1 min-w-0">
        <AnimatedContent>
          <div className="flex items-center gap-1 text-success text-[10px] font-black uppercase tracking-wider mb-1">
            <ShieldCheck size={14} /> Verified Health Partner
          </div>
          <h4 className="font-black text-base-content truncate">{ad.adContent.headline}</h4>
          <p className="text-xs text-base-content/60 truncate mt-0.5">{ad.adContent.subHeadline}</p>
        </AnimatedContent>
      </div>
      <button className="btn btn-circle btn-success btn-sm shrink-0 group-hover:scale-110 transition-transform shadow-sm">
        <ArrowRight size={16} />
      </button>
    </div>
  );
};

const RideTrackingAd = ({ ads, slot, onView, onClick }) => {
  const ad = ads[0];
  const [dismissed, setDismissed] = useState(false);
  const ref = useViewTracking(ad?._id, onView);
  
  if (!ad || dismissed) return null;

  return (
    <motion.div 
      ref={ref} 
      initial={{ y: 150, opacity: 0 }} 
      animate={{ y: 0, opacity: 1 }} 
      transition={{ type: "spring", damping: 20, stiffness: 200, delay: 1 }}
      className="fixed bottom-safe left-4 right-4 md:left-auto md:right-6 md:w-96 z-[990] pb-6"
    >
      <div className="card bg-neutral text-neutral-content p-5 shadow-2xl border-white/10 relative overflow-hidden backdrop-blur-strong">
        <button 
          onClick={(e) => { e.stopPropagation(); setDismissed(true); }} 
          className="absolute top-2 right-2 p-2 text-white/40 hover:text-white transition-colors rounded-full hover:bg-white/10"
        >
          <X size={16} />
        </button>
        
        <div className="flex items-center gap-4 mb-4">
          <div className="w-14 h-14 rounded-box overflow-hidden bg-base-300 shrink-0 border border-white/10">
            <AdMedia ad={ad} className="w-full h-full" />
          </div>
          <div className="min-w-0 pr-6">
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-2 w-2 rounded-full bg-accent animate-pulse" />
              <p className="text-[10px] font-bold text-accent uppercase tracking-widest">En_Route Offer</p>
            </div>
            <h5 className="font-black text-sm truncate">{ad.adContent.headline}</h5>
          </div>
        </div>
        
        <button 
          onClick={() => onClick(ad)} 
          className="btn-primary-cta w-full py-3 text-xs flex justify-center items-center shadow-primary bg-primary border-none text-primary-content hover:brightness-110"
        >
          {ad.adContent.ctaText} <Zap size={14} className="ml-1.5 fill-current" />
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
    <div ref={ref} onClick={() => onClick(ad)} className="border-b border-base-300 py-8 group cursor-pointer surface-tint px-6 rounded-box mb-6 transition-colors">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-field bg-primary/10 flex items-center justify-center text-xs font-black text-primary border border-primary/20">
            {ad.advertiser.name.charAt(0)}
          </div>
          <div>
            <span className="text-sm font-black text-base-content block leading-none">{ad.advertiser.name}</span>
            <span className="text-[10px] text-base-content/50 font-bold uppercase tracking-widest">Sponsored Result</span>
          </div>
        </div>
        <Info size={16} className="text-base-content/30" />
      </div>
      
      <h3 className="text-xl md:text-2xl font-black text-primary group-hover:text-primary/80 transition-colors mb-2 leading-tight">
        {ad.adContent.headline}
      </h3>
      <p className="text-sm text-base-content/70 mb-6 max-w-3xl leading-relaxed">
        {ad.adContent.subHeadline}
      </p>
      
      {ad.adContent.mediaUrl && (
        <div className="w-full max-w-3xl aspect-video rounded-box overflow-hidden border border-base-300 shadow-sm relative group-hover:shadow-md transition-shadow">
          <AdMedia ad={ad} className="w-full h-full group-hover:scale-[1.02]" />
        </div>
      )}
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. MAIN COMPONENT (State & Orchestration)
// ─────────────────────────────────────────────────────────────────────────────

const PAGE_COMPONENT_MAP = {
  Global: GlobalAd,
  Medicine_Store: MedicineStoreAd,
  Ride_Tracking_Screen: RideTrackingAd,
  Search_Results: SearchResultsAd,
};

const ADS = ({ page, slot, className = "" }) => {
  const dispatch = useDispatch();
  const bannerKey = `${page}_${slot}`;

  // Optimize Selector: Extract only the exact array we need to prevent root re-renders
  const rawAds = useSelector((state) => state.ads.bannersByKey?.[bannerKey]);
  const isRefreshing = useSelector((state) => state.ads.isRefreshing);

  // Initialize ads safely
  const ads = useMemo(() => rawAds || [], [rawAds]);
  const { handleView, handleClick } = useAdInteraction(dispatch);

  useEffect(() => {
    dispatch(fetchActiveBanners({ page, slot }));
  }, [dispatch, page, slot]);

  // Client-side priority & media type sorting safety net
  const sortedAds = useMemo(() => {
    if (!ads.length) return [];
    return [...ads].sort((a, b) => {
      // 1. Priority (Descending)
      const priorityDiff = (b.placement?.priority || 1) - (a.placement?.priority || 1);
      if (priorityDiff !== 0) return priorityDiff;
      
      // 2. Media Type Order (Video > Gif > Image)
      const mediaOrder = { Video: 0, Gif: 1, Image: 2 };
      const aMedia = mediaOrder[a.adContent?.mediaType] ?? 2;
      const bMedia = mediaOrder[b.adContent?.mediaType] ?? 2;
      return aMedia - bMedia;
    });
  }, [ads]);

  // Loading State aligned with theme
  if (isRefreshing && sortedAds.length === 0) {
    return (
      <div className={`w-full ${className}`}>
        <Container>
          <div 
            className="skeleton w-full rounded-box border border-base-300"
            style={{ height: slot === 'Hero_Banner' ? '350px' : '140px' }}
          />
        </Container>
      </div>
    );
  }

  // Null State
  if (!sortedAds.length) return null;

  // Resolve specific component to render
  const adPage = sortedAds[0]?.placement?.page ?? page;
  const AdComponent = PAGE_COMPONENT_MAP[adPage] ?? GlobalAd;

  return (
    <section className={`w-full h-auto ${className}`}>
      <Container>
        <AdComponent 
          ads={sortedAds} 
          slot={slot} 
          onView={handleView} 
          onClick={handleClick} 
        />
      </Container>
    </section>
  );
};

export default ADS;