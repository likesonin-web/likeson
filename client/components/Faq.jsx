"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Search, HelpCircle, ChevronRight, MessageCircle, 
  PhoneCall, ArrowRight, Truck, Stethoscope, 
  Pill, Beaker, Sparkles, Activity, FileQuestion
} from 'lucide-react';

// Note: Ensure your Redux slice is correctly mapped
import { fetchFAQs, selectAllFAQs, selectFAQLoading } from '@/store/slices/faqSlice';

// --- Metadata ---
export const metadata = {
  title: 'Frequently Asked Questions | Likeson Healthcare',
  description: 'Find instant answers to your medical service queries, from ambulance transportation to pharmacy and lab diagnostics.',
};

// ─── Animated Creature 1: DocOwl (The Wise Medical Guide - Hero) ───────────────

const DocOwl = () => {
  return (
    <div className="relative w-56 h-56 mx-auto lg:mx-0 z-10 pointer-events-none select-none" aria-hidden="true">
      {/* Ambient Wisdom Glow */}
      <motion.div
        animate={{ scale: [1, 1.1, 1], opacity: [0.15, 0.25, 0.15] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 m-auto w-40 h-40 rounded-full bg-primary/20 blur-2xl"
      />

      <motion.div
        animate={{ y: [-8, 8, -8] }}
        transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        className="w-full h-full relative"
      >
        <svg viewBox="0 0 200 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-full drop-shadow-xl">
          {/* Glowing Question Mark (Thoughts) */}
          <motion.g
            animate={{ y: [0, -5, 0], opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            <path d="M145 45 C145 35, 160 35, 160 45 C160 55, 150 55, 150 65" stroke="var(--primary)" strokeWidth="4" strokeLinecap="round" fill="none" style={{ filter: 'drop-shadow(0 0 4px var(--primary))' }} />
            <circle cx="150" cy="75" r="2.5" fill="var(--primary)" style={{ filter: 'drop-shadow(0 0 4px var(--primary))' }} />
          </motion.g>

          {/* Owl Ear Tufts */}
          <motion.path 
            d="M60 80 L45 45 L80 65" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round"
            animate={{ rotate: [-2, 2, -2] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: '60px 80px' }}
          />
          <motion.path 
            d="M140 80 L155 45 L120 65" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="3" strokeLinejoin="round"
            animate={{ rotate: [2, -2, 2] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: '140px 80px' }}
          />

          {/* Wings (Flapping subtly) */}
          <motion.path 
            d="M55 110 C35 130, 40 160, 50 160 C60 160, 60 130, 60 110" fill="var(--primary)" opacity="0.9"
            animate={{ rotate: [0, 8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: '55px 110px' }}
          />
          <motion.path 
            d="M145 110 C165 130, 160 160, 150 160 C140 160, 140 130, 140 110" fill="var(--primary)" opacity="0.9"
            animate={{ rotate: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: '145px 110px' }}
          />

          {/* Main Body */}
          <rect x="50" y="60" width="100" height="110" rx="50" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" />
          
          {/* Belly */}
          <rect x="65" y="105" width="70" height="55" rx="27.5" fill="var(--base-200)" stroke="var(--base-300)" strokeWidth="2" strokeDasharray="4 4" />

          {/* Head & Face Group (Slight tilt) */}
          <motion.g
            animate={{ rotate: [-1, 2, -1] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={{ transformOrigin: '100px 90px' }}
          >
            {/* Reading Glasses (The Owl Eyes) */}
            <circle cx="75" cy="85" r="18" fill="var(--base-100)" stroke="var(--primary)" strokeWidth="4" />
            <circle cx="125" cy="85" r="18" fill="var(--base-100)" stroke="var(--primary)" strokeWidth="4" />
            <line x1="93" y1="85" x2="107" y2="85" stroke="var(--primary)" strokeWidth="4" />

            {/* Blinking Pupils */}
            <motion.g
              animate={{ scaleY: [1, 1, 0.1, 1, 1] }}
              transition={{ duration: 5, repeat: Infinity, times: [0, 0.45, 0.5, 0.55, 1] }}
              style={{ transformOrigin: 'center' }}
            >
              <circle cx="75" cy="85" r="6" fill="var(--base-content)" />
              <circle cx="125" cy="85" r="6" fill="var(--base-content)" />
              
              {/* Catchlights (Eye sparkles) */}
              <circle cx="73" cy="83" r="2" fill="white" />
              <circle cx="123" cy="83" r="2" fill="white" />
            </motion.g>

            {/* Beak */}
            <path d="M100 102 L95 93 L105 93 Z" fill="var(--accent)" />
          </motion.g>

          {/* Medical Stethoscope draped around neck */}
          <path d="M68 115 C68 140, 132 140, 132 115" stroke="var(--base-content)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
          <path d="M100 133 L100 145" stroke="var(--base-content)" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
          <circle cx="100" cy="148" r="6" fill="var(--base-200)" stroke="var(--base-content)" strokeWidth="2.5" />
          <circle cx="100" cy="148" r="2" fill="var(--error)" />

        </svg>
      </motion.div>
    </div>
  );
};

// ─── Animated Creature 2: PillBot (The Pharmacy Helper) ───────────────

const PillBot = () => {
  return (
    <motion.div
      animate={{ y: [-5, 5, -5], rotate: [-2, 2, -2] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      className="w-24 h-24 sm:w-32 sm:h-32 relative pointer-events-none select-none flex-shrink-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Top half - Primary Color */}
        <path d="M30 50 L30 40 C30 28.95 38.95 20 50 20 C61.05 20 70 28.95 70 40 L70 50 Z" fill="var(--primary)" />
        {/* Bottom half - White/Base */}
        <path d="M30 50 L70 50 L70 60 C70 71.05 61.05 80 50 80 C38.95 80 30 71.05 30 60 Z" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="2.5" />
        {/* Middle Band */}
        <line x1="28" y1="50" x2="72" y2="50" stroke="var(--base-300)" strokeWidth="2.5" strokeLinecap="round" />
        
        {/* Cute Blinking Eyes */}
        <motion.g
           animate={{ scaleY: [1, 0.1, 1] }}
           transition={{ duration: 4, repeat: Infinity, times: [0, 0.05, 0.1], repeatDelay: 3 }}
           style={{ transformOrigin: 'center' }}
        >
          <circle cx="42" cy="62" r="3.5" fill="var(--base-content)" />
          <circle cx="58" cy="62" r="3.5" fill="var(--base-content)" />
        </motion.g>
        
        {/* Small Medical Cross */}
        <path d="M47 30 h6 v3 h3 v6 h-3 v3 h-6 v-3 h-3 v-6 h3 z" fill="white" opacity="0.9" />

        {/* Floating Healing Particles */}
        <motion.circle cx="85" cy="30" r="2" fill="var(--accent)" animate={{ y: [0, -10, 0], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} />
        <motion.circle cx="20" cy="40" r="1.5" fill="var(--primary)" animate={{ y: [0, -15, 0], opacity: [0, 1, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 1, ease: "easeInOut" }} />
      </svg>
    </motion.div>
  );
};

// ─── Animated Creature 3: Hearty (The Wellness Companion) ───────────────

const Hearty = () => {
  return (
    <motion.div
      animate={{ y: [4, -4, 4] }}
      transition={{ duration: 4.5, repeat: Infinity, ease: "easeInOut" }}
      className="w-24 h-24 sm:w-32 sm:h-32 relative pointer-events-none select-none flex-shrink-0"
      aria-hidden="true"
    >
      <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-md">
        {/* Beating Heart Body */}
        <motion.g
          animate={{ scale: [1, 1.15, 1, 1.15, 1] }}
          transition={{ duration: 1.5, repeat: Infinity, times: [0, 0.15, 0.3, 0.45, 1] }}
          style={{ transformOrigin: '50px 50px' }}
        >
          <path d="M50 85 C 50 85, 15 55, 15 35 C 15 15, 35 10, 50 25 C 65 10, 85 15, 85 35 C 85 55, 50 85, 50 85 Z" fill="var(--error)" />
          
          {/* Happy Face */}
          <circle cx="38" cy="40" r="3.5" fill="white" />
          <circle cx="62" cy="40" r="3.5" fill="white" />
          <path d="M44 48 Q 50 54 56 48" stroke="white" strokeWidth="2.5" strokeLinecap="round" fill="none" />
        </motion.g>
        
        {/* Orbiting ECG Ring */}
        <motion.circle 
          cx="50" cy="50" r="42" stroke="var(--error)" strokeWidth="1.5" strokeDasharray="6 6" fill="none" opacity="0.3"
          animate={{ rotate: 360 }} transition={{ duration: 12, repeat: Infinity, ease: "linear" }} style={{ transformOrigin: "50px 50px"}} 
        />
        
        {/* Sparkle */}
        <motion.path 
          d="M80 20 L82 15 L87 13 L82 11 L80 6 L78 11 L73 13 L78 15 Z" fill="var(--accent)"
          animate={{ scale: [0, 1, 0], rotate: 180 }} transition={{ duration: 3, repeat: Infinity }}
        />
      </svg>
    </motion.div>
  );
};


// ─── Static Data & Fallbacks ──────────────────────────────────────────────────

const CATEGORIES = [
  { id: 'All', title: 'Overview', icon: HelpCircle },
  { id: 'Medical Transportation', title: 'Ambulance', icon: Truck },
  { id: 'Doctor Consultation', title: 'Consult', icon: Stethoscope },
  { id: 'Pharmacy Services', title: 'Pharmacy', icon: Pill },
  { id: 'Diagnostics', title: 'Lab Work', icon: Beaker },
];

const STATIC_FAQS = [
  {
    _id: "faq-1",
    category: "Medical Transportation",
    question: "How do I track my ambulance in real-time?",
    answer: "Once your Full Care Ride or Ambulance is dispatched, you will receive an SMS and an app notification with a live GPS tracking link. You can monitor the vehicle's exact location and estimated time of arrival (ETA) directly from your dashboard."
  },
  {
    _id: "faq-2",
    category: "Doctor Consultation",
    question: "Are the doctors on Likeson board-certified?",
    answer: "Absolutely. Every doctor on our platform undergoes a rigorous 5-step background check. We verify their medical council registration, educational qualifications, and clinical experience to ensure you receive premium, reliable care."
  },
  {
    _id: "faq-3",
    category: "Pharmacy Services",
    question: "How fast is the pharmacy delivery?",
    answer: "For standard prescriptions, we guarantee express delivery within 2 hours. Life-saving and cold-chain medicines are transported in specialized temperature-controlled vehicles to maintain complete efficacy."
  },
  {
    _id: "faq-4",
    category: "Diagnostics",
    question: "Can I get my lab samples collected at home?",
    answer: "Yes! Our NABL-accredited lab partners offer free home sample collection. A certified phlebotomist will visit your home at your scheduled time, and digital reports will be uploaded directly to your Likeson account within 6 to 48 hours."
  }
];

const accordionVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }
};

// ─── Atomic Components ────────────────────────────────────────────────────────

const CategoryCard = memo(({ title, icon: Icon, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isActive}
    className={`group relative flex flex-col items-center justify-center p-4 sm:p-5 min-w-[110px] sm:min-w-[130px] border-[1.5px] transition-all duration-300 rounded-[var(--r-box)] overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      isActive 
      ? 'border-transparent shadow-primary scale-[1.02]' 
      : 'bg-base-100 border-base-300 text-base-content hover:border-primary/40 hover:bg-base-200/50 hover:-translate-y-0.5 shadow-sm'
    }`}
    style={isActive ? { backgroundImage: 'var(--bg-gradient-primary)', color: 'var(--primary-content)' } : {}}
  >
    <div className={`relative z-10 p-2.5 rounded-[var(--r-field)] transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 ${isActive ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'}`}>
      <Icon size={24} aria-hidden="true" strokeWidth={isActive ? 2.5 : 2} />
    </div>
    <span className={`relative z-10 mt-3 font-bold text-[10px] uppercase tracking-widest font-poppins ${isActive ? 'text-white' : ''}`}>
      {title}
    </span>
  </button>
));
CategoryCard.displayName = 'CategoryCard';

const AccordionItem = memo(({ id, question, answer, isOpen, onClick }) => (
  <div className={`mb-4 rounded-[var(--r-box)] border transition-all duration-300 overflow-hidden ${
      isOpen ? 'border-primary/40 bg-base-100 shadow-[0_8px_24px_-4px_rgba(0,0,0,0.08)]' : 'border-base-300 bg-base-100 hover:border-primary/30 hover:shadow-sm'
    }`}
  >
    <button 
      onClick={onClick} 
      aria-expanded={isOpen}
      aria-controls={`faq-answer-${id}`}
      id={`faq-question-${id}`}
      className="w-full p-5 sm:p-6 flex items-center justify-between text-left group outline-none focus-visible:bg-base-200"
    >
      <div className="flex items-start sm:items-center gap-4 pr-4">
        <div className={`mt-1.5 sm:mt-0 w-2.5 h-2.5 rounded-full shrink-0 transition-all duration-300 ${isOpen ? 'bg-primary shadow-[0_0_8px_var(--color-primary)]' : 'bg-base-300 group-hover:bg-primary/50 group-hover:scale-110'}`} aria-hidden="true" />
        <span className={`text-xs sm:text-base font-bold transition-colors duration-300 font-poppins leading-snug ${isOpen ? 'text-primary' : 'text-base-content/90 group-hover:text-primary'}`}>
          {question}
        </span>
      </div>
      <div className={`shrink-0 p-1.5 rounded-full border transition-all duration-300 ${isOpen ? 'text-primary-content bg-primary border-transparent rotate-90 shadow-sm' : 'text-base-content/40 border-base-300 group-hover:border-primary/40 group-hover:text-primary bg-base-200'}`} aria-hidden="true">
        <ChevronRight size={16} strokeWidth={2.5} />
      </div>
    </button>
    
    <AnimatePresence initial={false}>
      {isOpen && (
        <motion.div
          id={`faq-answer-${id}`}
          role="region"
          aria-labelledby={`faq-question-${id}`}
          variants={accordionVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden bg-base-200/30"
        >
          <div className="px-6 sm:px-12 pb-7 pt-1">
            <p className="text-xs sm:text-base text-base-content/70 leading-relaxed border-l-2 border-primary/30 pl-5 font-poppins">
              {answer}
            </p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  </div>
));
AccordionItem.displayName = 'AccordionItem';

// ─── Main Page Component ──────────────────────────────────────────────────────

export default function FAQPage() {
  const dispatch = useDispatch();
  const reduxFaqs = useSelector(selectAllFAQs);
  const isLoading = useSelector(selectFAQLoading);
  
  // Use Redux data if available, otherwise fall back to static high-quality FAQs
  const faqs = reduxFaqs?.length > 0 ? reduxFaqs : STATIC_FAQS;
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState(null);

  useEffect(() => {
    const handleFetch = () => {
      if (!reduxFaqs?.length && !isLoading) dispatch(fetchFAQs({ isActive: true }));
    };
    if ('requestIdleCallback' in window) window.requestIdleCallback(() => handleFetch());
    else setTimeout(handleFetch, 200);
  }, [dispatch, reduxFaqs?.length, isLoading]);

  const filteredFaqs = useMemo(() => {
    return faqs.filter(faq => {
      const q = (faq.question || '').toLowerCase();
      const a = (faq.answer || '').toLowerCase();
      const s = searchTerm.toLowerCase();
      const matchesSearch = q.includes(s) || a.includes(s);
      const matchesCategory = activeCategory === 'All' || faq.category === activeCategory;
      return matchesSearch && matchesCategory;
    });
  }, [faqs, searchTerm, activeCategory]);

  const handleCategoryChange = useCallback((id) => {
    setActiveCategory(id);
    setOpenIndex(null);
  }, []);

  const handleAccordionToggle = useCallback((idx) => {
    setOpenIndex(prev => (prev === idx ? null : idx));
  }, []);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": filteredFaqs.slice(0, 10).map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": { "@type": "Answer", "text": faq.answer }
    }))
  };

  return (
    <div className="min-h-screen bg-base-100 w-full overflow-x-hidden text-base-content selection:bg-primary/20 selection:text-primary">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      
      <a href="#main-faq-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-6 focus:py-3 focus:bg-primary focus:text-primary-content rounded-[var(--r-field)] font-bold shadow-xl">
        Skip to content
      </a>

      {/* Decorative Background */}
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] rounded-full blur-[120px] bg-primary/5" />
        <div className="absolute top-[30%] left-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] bg-secondary/5" />
      </div>

      <main id="main-faq-content" className="relative z-10 container-custom pt-12 lg:pt-20 pb-32">
        
        {/* ─── HERO SECTION ─── */}
        <section className="flex flex-col lg:flex-row items-center justify-between gap-10 mb-16 lg:mb-24">
          
          {/* Text Content */}
          <div className="flex-1 text-center lg:text-left">
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-6">
                <Activity size={14} className="animate-pulse" aria-hidden="true" />
                Healthcare Knowledge Base
              </div>

              <h1 className="font-montserrat text-4xl sm:text-5xl md:text-6xl font-black tracking-tight leading-[1.1] mb-6">
                Find Your <br className="hidden md:block" />
                <span className="text-gradient-primary">Answers</span> Here.
              </h1>
              
              <p className="font-poppins text-base-content/60 text-xs sm:text-base font-medium max-w-lg mx-auto lg:mx-0 leading-relaxed mb-8">
                Everything you need to know about our medical services, from booking an ambulance to receiving lab reports at home.
              </p>

              <div className="relative max-w-xl mx-auto lg:mx-0 group">
                <div className="relative flex h-16 items-center bg-base-100 border-2 border-base-300 rounded-[var(--r-field)] shadow-sm overflow-hidden focus-within:border-primary focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--primary),transparent_80%)] transition-all duration-300">
                  <label htmlFor="faq-search" className="sr-only">Search medical topics</label>
                  <Search className="ml-5 text-base-content/40 group-focus-within:text-primary transition-colors" size={22} aria-hidden="true" />
                  <input 
                    id="faq-search"
                    type="search"
                    placeholder="Search for appointments, pharmacies..."
                    className="w-full py-5 px-4 bg-transparent outline-none text-base font-bold text-base-content placeholder:text-base-content/30 placeholder:font-medium font-poppins"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                  {/* Visual Keyboard Hint */}
                  <div className="hidden sm:flex mr-5 px-2 py-1 bg-base-200 rounded text-[10px] font-bold text-base-content/40 font-mono tracking-widest border border-base-300 select-none">
                    SEARCH
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          {/* Animated SVG Creature (DocOwl) */}
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }} 
            animate={{ opacity: 1, scale: 1 }} 
            transition={{ duration: 0.7, delay: 0.2 }}
            className="flex-shrink-0"
          >
            <DocOwl />
          </motion.div>

        </section>

        {/* ─── CONTENT AREA ─── */}
        <LayoutGroup>
          {/* Categories */}
          <nav className="flex flex-wrap items-center justify-center lg:justify-start gap-3 sm:gap-4 mb-12 sm:mb-16" aria-label="FAQ Categories">
            {CATEGORIES.map((cat) => (
              <CategoryCard 
                key={cat.id}
                title={cat.title}
                icon={cat.icon}
                isActive={activeCategory === cat.id}
                onClick={() => handleCategoryChange(cat.id)}
              />
            ))}
          </nav>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-14">
            
            {/* FAQ Accordions & Bottom Creatures */}
            <div className="lg:col-span-8 flex flex-col">
              <div className="flex items-center gap-3 mb-8">
                <span className="w-10 h-10 rounded-[var(--r-field)] bg-primary/10 text-primary flex items-center justify-center shrink-0" aria-hidden="true">
                  <Sparkles size={20} />
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-montserrat tracking-tight">
                  Frequently Asked
                </h2>
              </div>

              <div aria-live="polite" className="min-h-[400px]">
                {isLoading ? (
                  <div className="space-y-4" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton h-20 w-full rounded-[var(--r-box)]" />)}
                  </div>
                ) : filteredFaqs.length === 0 ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="flex flex-col items-center justify-center py-20 px-6 text-center border-2 border-dashed border-base-300 rounded-[var(--r-box)] bg-base-200/50"
                  >
                    <div className="w-16 h-16 bg-base-100 rounded-full flex items-center justify-center shadow-sm mb-5 text-base-content/30 border border-base-300">
                      <FileQuestion size={32} />
                    </div>
                    <h3 className="text-xl font-black mb-2 font-montserrat text-base-content">No answers found</h3>
                    <p className="text-xs text-base-content/60 max-w-sm mb-6 font-poppins font-medium">
                      We couldn't find any FAQs matching "{searchTerm}". Try a different keyword or browse categories.
                    </p>
                    <button 
                      onClick={() => { setSearchTerm(''); setActiveCategory('All'); }}
                      className="btn btn-outline btn-sm font-bold uppercase tracking-wider rounded-full"
                    >
                      Clear Search
                    </button>
                  </motion.div>
                ) : (
                  <div className="space-y-3 sm:space-y-4">
                    {filteredFaqs.map((faq, idx) => (
                      <AccordionItem 
                        key={faq._id || `faq-${idx}`}
                        id={faq._id || idx.toString()}
                        question={faq.question}
                        answer={faq.answer}
                        isOpen={openIndex === idx}
                        onClick={() => handleAccordionToggle(idx)}
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* ─── Bottom Animated Creatures Section ─── */}
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                className="mt-12 p-6 sm:p-8 rounded-[var(--r-box)] border border-base-300 bg-[radial-gradient(ellipse_at_center,_color-mix(in_oklch,var(--primary)_5%,transparent)_0%,transparent_100%)] flex flex-col sm:flex-row items-center justify-between gap-6 relative overflow-hidden"
              >
                <PillBot />
                
                <div className="text-center z-10 px-2 sm:px-4">
                  <h4 className="font-montserrat font-black text-lg sm:text-xl text-base-content mb-2 tracking-tight">
                    Still wondering?
                  </h4>
                  <p className="font-poppins text-xs text-base-content/60 font-medium">
                    Our wellness bots and medical coordinators are always here to assist you.
                  </p>
                </div>

                <Hearty />
              </motion.div>

            </div>

            {/* Sticky Sidebar / Support Aside */}
            <aside className="lg:col-span-4">
              <div className="sticky top-24 space-y-6">
                
                {/* Emergency / Chat Card */}
                <div className="relative p-8 rounded-[var(--r-box)] text-white overflow-hidden shadow-2xl" style={{ backgroundImage: 'var(--bg-gradient-primary)' }}>
                  {/* Decorative Elements */}
                  <div className="absolute -top-16 -right-16 w-48 h-48 border-[1.5px] border-white/20 rounded-full animate-[spin_20s_linear_infinite]" aria-hidden="true" />
                  <div className="absolute top-8 -right-8 w-24 h-24 border-[1.5px] border-white/20 rounded-full animate-[spin_15s_linear_infinite_reverse]" aria-hidden="true" />
                  
                  <div className="relative z-10">
                    <h3 className="text-white text-2xl font-black mb-2 font-montserrat tracking-tight">Need Help Fast?</h3>
                    <p className="text-xs text-white/80 mb-8 font-medium font-poppins leading-relaxed">
                      Our medical coordinators are online and ready to assist you immediately.
                    </p>
                    
                    <div className="space-y-3">
                      <button type="button" className="w-full flex items-center justify-between group px-5 py-4 rounded-[var(--r-field)] bg-white text-primary font-black text-xs uppercase tracking-wider shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-all">
                        <span className="flex items-center gap-2.5">
                          <MessageCircle size={18} aria-hidden="true"/> Live Chat
                        </span>
                        <ArrowRight size={16} className="group-hover:translate-x-1.5 transition-transform" aria-hidden="true"/>
                      </button>
                      
                      <a href="tel:108" className="w-full py-4 rounded-[var(--r-field)] flex items-center justify-center gap-2.5 hover:bg-white/10 transition-all outline-none focus-visible:ring-2 focus-visible:ring-white border border-white/30 backdrop-blur-sm">
                        <PhoneCall size={16} className="text-white" aria-hidden="true" />
                        <span className="font-bold text-xs uppercase tracking-widest text-white">Emergency: 108</span>
                      </a>
                    </div>
                  </div>
                </div>

                {/* Email Support Card */}
                <div className="p-7 border border-base-300 rounded-[var(--r-box)] bg-base-100 shadow-sm hover:border-primary/30 hover:shadow-md transition-all group">
                  <h4 className="font-black text-base mb-2 text-base-content font-montserrat flex items-center gap-2">
                    Still need help?
                  </h4>
                  <p className="text-xs text-base-content/60 leading-relaxed font-poppins font-medium mb-5">
                    Send a detailed query to our medical desk. We respond within 24 hours.
                  </p>
                  <a href="mailto:support@likeson.in" className="inline-flex items-center gap-2 text-xs font-bold text-primary group-hover:text-secondary transition-colors underline decoration-primary/30 underline-offset-4">
                    support@likeson.in <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                  </a>
                </div>

              </div>
            </aside>
            
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}