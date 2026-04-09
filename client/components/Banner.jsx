"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ChevronRight, 
  ChevronLeft, 
  Stethoscope, 
  Activity,
  ShoppingBag,
  FlaskConical,
  ArrowUpRight,
  ShieldCheck,
  Zap,
  Microscope,
  Pill,
  Hospital,
  Gem,
  UserRound
} from 'lucide-react';
import { fetchActiveBanners, trackBannerClick } from '@/store/slices/bannerSlice';

/**
 * MASTER THEME CONFIGURATION
 * Mapped to Header.jsx color palette for brand consistency.
 */
const THEME_CONFIG = {
  Home_Top: {
    dimensions: "h-[350px] lg:h-[450px ] w-full",
    accent: "bg-[#4f46e5]", // indigo-600
    text: "text-[#4f46e5]",
    clipBg: "rgba(79,70,229,0.9)",
    icon: <UserRound className="w-5 h-5" />,
    textSize: "text-5xl lg:text-8xl",
    label: "Primary Care"
  },
  Home_Middle: {
    dimensions: "h-[350px] lg:h-[450px]  w-full",
    accent: "bg-[#7c3aed]", // violet-600
    text: "text-[#7c3aed]",
    clipBg: "rgba(124,58,237,0.9)",
    icon: <ShieldCheck className="w-5 h-5" />,
    textSize: "text-4xl lg:text-6xl",
    label: "Security & Trust"
  },
  Medicine_Page: {
    dimensions: "h-[250px] lg:h-[350px] w-full",
    accent: "bg-[#0d9488]", // teal-600
    text: "text-[#0d9488]",
    clipBg: "rgba(13,148,136,0.9)",
    icon: <Pill className="w-4 h-4" />,
    textSize: "text-3xl lg:text-5xl",
    label: "Pharmacy"
  },
  Lab_Page: {
    dimensions: "h-[250px] lg:h-[350px] w-full",
    accent: "bg-[#7c3aed]", // violet-600
    text: "text-[#7c3aed]",
    clipBg: "rgba(124,58,237,0.9)",
    icon: <Microscope className="w-4 h-4" />,
    textSize: "text-3xl lg:text-5xl",
    label: "Diagnostics"
  },
  Checkout_Bottom: {
    dimensions: "h-[250px] lg:h-[300px] w-full",
    accent: "bg-[#dc2626]", // red-600
    text: "text-[#dc2626]",
    clipBg: "rgba(220,38,38,0.9)",
    icon: <Hospital className="w-4 h-4" />,
    textSize: "text-3xl lg:text-5xl",
    label: "Hospital Care"
  }
};

const Banner = ({ position = 'Home_Top' }) => {
  const dispatch = useDispatch();
  const { activeBanners, isRefreshing } = useSelector((state) => state.banners);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [direction, setDirection] = useState(0);

  const theme = THEME_CONFIG[position] || THEME_CONFIG.Home_Top;

  useEffect(() => {
    dispatch(fetchActiveBanners(position));
  }, [dispatch, position]);

  const displayBanners = useMemo(() => {
    if (!activeBanners || !Array.isArray(activeBanners)) return [];
    return activeBanners
      .filter(item => item.position === position && item.isActive)
      .sort((a, b) => (b.priority || 0) - (a.priority || 0));
  }, [activeBanners, position]);

  const paginate = useCallback((newDirection) => {
    setDirection(newDirection);
    setCurrentIndex((prev) => (prev + newDirection + displayBanners.length) % displayBanners.length);
  }, [displayBanners.length]);

  useEffect(() => {
    if (displayBanners.length <= 1) return;
    const timer = setInterval(() => paginate(1), 8000);
    return () => clearInterval(timer);
  }, [displayBanners.length, paginate]);

  if (isRefreshing && (!displayBanners || displayBanners.length === 0)) {
    return <div className={`w-full ${theme.dimensions} bg-neutral-900 animate-pulse`} />;
  }
  if (!displayBanners || displayBanners.length === 0) return null;

  return (
    <div className="w-full relative overflow-hidden rounded-xl bg-black">
      <div className={`relative ${theme.dimensions}`}>
        
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={currentIndex}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ x: { type: "spring", stiffness: 180, damping: 25 }, opacity: { duration: 0.3 } }}
            className="absolute inset-0 w-full h-full"
          >
            <BannerItem 
              data={displayBanners[currentIndex]} 
              theme={theme}
              onInteraction={() => dispatch(trackBannerClick(displayBanners[currentIndex]._id))}
            />
          </motion.div>
        </AnimatePresence>

        {/* Square Navigation Controls */}
        {displayBanners.length > 1 && (
          <div className="absolute top-1/2 -translate-y-1/2 w-full flex justify-between px-6 z-50 pointer-events-none">
            <button onClick={() => paginate(-1)} className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 border border-white/10 text-white hover:bg-white hover:text-black transition-all">
              <ChevronLeft size={24} />
            </button>
            <button onClick={() => paginate(1)} className="pointer-events-auto w-12 h-12 flex items-center justify-center bg-black/40 border border-white/10 text-white hover:bg-white hover:text-black transition-all">
              <ChevronRight size={24} />
            </button>
          </div>
        )}

        {/* Index Tracking (Square) */}
        <div className="absolute bottom-10 right-10 z-40 flex gap-3">
          {displayBanners.map((_, i) => (
            <div 
              key={i} 
              className={`h-1 transition-all duration-300 ${i === currentIndex ? 'w-10 bg-white' : 'w-4 bg-white/20'}`} 
            />
          ))}
        </div>

        {/* Theme-Colored Progress Line */}
        <div className="absolute bottom-0 left-0 w-full h-[4px] bg-white/5 z-50">
          <motion.div 
            key={currentIndex}
            initial={{ width: 0 }} 
            animate={{ width: "100%" }} 
            transition={{ duration: 8, ease: "linear" }}
            className={`h-full ${theme.accent}`}
          />
        </div>
      </div>
    </div>
  );
};

const BannerItem = ({ data, theme, onInteraction }) => {
  const getHref = () => {
    switch (data.targetType) {
      case 'ExternalLink': return data.externalUrl;
      case 'Hospital': return `/hospitals/${data.targetId}`;
      case 'Product': return `/products/${data.targetId}`;
      default: return data.targetId || '#';
    }
  };

  return (
    <div className="relative w-full h-full  group/item">
      {/* Background with Full Bleed */}
      <div className="absolute  inset-0 z-0">
        <Image 
          src={data.imageUrl} 
          alt={data.title} 
          fill 
          className="object-cover transition-transform duration-[20000ms] group-hover/item:scale-110" 
          priority 
        />
        {/* Optimized Masks: Stronger bottom-up gradient for mobile readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10" />
        <div className="absolute inset-0 hidden md:block bg-gradient-to-r from-black/60 via-transparent to-transparent z-11" />
      </div>

      {/* Mobile: items-end (bottom-heavy for thumb reach)
          Desktop: md:items-center (cinematic balance)
      */}
      <div className="relative z-20 h-full flex items-end md:items-center px-5 md:px-20 lg:px-32 pb-16 md:pb-0">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.5 }}
          className="w-full max-w-6xl flex flex-col items-start"
        >
       
        

          {/* MASTER CLIP-PATH TITLE (w-fit) */}
          <div className="relative w-fit mb-3 md:mb-4">
            <motion.div 
              initial={{ scaleX: 0 }}
              animate={{ scaleX: 1 }}
              transition={{ delay: 0.4, duration: 0.8, ease: [0.19, 1, 0.22, 1] }}
              className="absolute inset-0 -inset-y-0.5 md:-inset-y-1 z-0 origin-left opacity-95"
              style={{ 
                background: theme.clipBg,
                clipPath: 'polygon(0% 0%, 100% 0%, 96% 100%, 0% 100%)',
              }}
            />
            
            <h2 className="text-xl md:text-3xl relative z-10 font-black text-white leading-[1.2] md:leading-relaxed tracking-tighter uppercase italic px-2 md:px-4">
              {data.title}
            </h2>
          </div>

          {/* Subtitle: Hidden on small height mobile, clamped to 2 lines on others */}
          {data.subTitle && (
            <p className="text-white/80 text-xs md:text-xl font-light mb-6 md:mb-8 max-w-lg md:max-w-2xl leading-relaxed border-l border-white/20 pl-4 line-clamp-2 md:line-clamp-none">
              {data.subTitle}
            </p>
          )}

          {/* Action Button: Reduced padding on mobile */}
          <Link 
            href={getHref()} 
            onClick={onInteraction}
            className={`inline-flex items-center gap-3 md:gap-4 ${theme.accent} text-white px-5 md:px-8 py-3 md:py-5 font-bold text-[10px] md:text-sm uppercase tracking-[0.2em] md:tracking-[0.3em] hover:brightness-110 transition-all active:scale-95 group/btn shadow-2xl`}
          >
            <span>Explore Now</span>
            <div className="w-6 h-6 md:w-8 md:h-8 flex items-center justify-center border border-white/20 group-hover/btn:bg-white group-hover/btn:text-black transition-all">
              <ArrowUpRight size={14} className="md:w-[18px] md:h-[18px]" />
            </div>
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

const slideVariants = {
  enter: (dir) => ({ x: dir > 0 ? '100%' : '-100%', opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir) => ({ x: dir < 0 ? '100%' : '-100%', opacity: 0 })
};

export default Banner;