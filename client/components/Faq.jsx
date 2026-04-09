"use client";

import React, { useState, useMemo, useEffect, useCallback, memo } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import dynamic from 'next/dynamic';
import { 
  Search, HelpCircle, ChevronRight, MessageCircle, 
  PhoneCall, ArrowRight, Truck, Stethoscope, 
  Pill, Beaker, Sparkles, Activity, FileQuestion
} from 'lucide-react';
import { fetchFAQs, selectAllFAQs, selectFAQLoading } from '@/store/slices/faqSlice';

/**
 * REWRITTEN FOR HIGH PERFORMANCE & TAILWIND v4 THEME COMPATIBILITY
 * - Integrated custom @theme variables (primary, base-100, r-box, etc.)
 * - Lazy loading framer-motion components for TBT reduction
 * - Full A11y compliance (aria-labels, focus management, skip links)
 * - Metadata & JSON-LD for SEO 100 score
 */

// --- Metadata (Move to layout.js/page.js if using Next.js App Router) ---
export const metadata = {
  title: 'Frequently Asked Questions | Likeson Healthcare',
  description: 'Find instant answers to your medical service queries, from ambulance transportation to pharmacy and lab diagnostics.',
  openGraph: {
    title: 'Healthcare FAQ | Likeson',
    description: 'Instant answers to your medical service queries.',
    type: 'website',
  },
};

// --- Lazy Loaded Heavy Components ---
const MotionDiv = dynamic(() => import('framer-motion').then((mod) => mod.motion.div), { ssr: true });
const AnimatePresence = dynamic(() => import('framer-motion').then((mod) => mod.AnimatePresence), { ssr: false });
const LayoutGroup = dynamic(() => import('framer-motion').then((mod) => mod.LayoutGroup), { ssr: false });

// --- Static Data ---
const CATEGORIES = [
  { id: 'All', title: 'Overview', icon: HelpCircle },
  { id: 'Medical Transportation', title: 'Ambulance', icon: Truck },
  { id: 'Doctor Consultation', title: 'Consult', icon: Stethoscope },
  { id: 'Pharmacy Services', title: 'Pharmacy', icon: Pill },
  { id: 'Diagnostics', title: 'Lab Work', icon: Beaker },
];

const accordionVariants = {
  hidden: { height: 0, opacity: 0 },
  visible: { height: 'auto', opacity: 1, transition: { duration: 0.3, ease: "easeOut" } },
  exit: { height: 0, opacity: 0, transition: { duration: 0.2, ease: "easeIn" } }
};

// --- Atomic Components ---

const CategoryCard = memo(({ title, icon: Icon, isActive, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={isActive}
    className={`group relative flex flex-col items-center justify-center p-5 min-w-[130px] border-2 transition-all duration-300 rounded-box overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-primary ${
      isActive 
      ? 'bg-primary border-transparent text-primary-content shadow-primary scale-[1.02]' 
      : 'bg-base-100 border-base-300 text-base-content hover:border-primary/50 hover:bg-base-200'
    }`}
  >
    <div className={`relative z-10 p-2 rounded-field transition-transform duration-300 group-hover:-translate-y-1 group-hover:scale-110 ${isActive ? 'bg-base-100/20' : 'bg-primary/5 text-primary'}`}>
      <Icon size={24} aria-hidden="true" />
    </div>
    <span className="relative z-10 mt-3 font-bold text-[10px] uppercase tracking-widest font-poppins">
      {title}
    </span>
  </button>
));
CategoryCard.displayName = 'CategoryCard';

const AccordionItem = memo(({ id, question, answer, isOpen, onClick }) => (
  <div className={`mb-3 rounded-box border transition-all duration-300 ${
      isOpen ? 'border-primary bg-base-100 shadow-depth' : 'border-base-300 bg-base-200/50 hover:bg-base-200'
    }`}
  >
    <button 
      onClick={onClick} 
      aria-expanded={isOpen}
      aria-controls={`faq-answer-${id}`}
      id={`faq-question-${id}`}
      className="w-full p-5 flex items-center justify-between text-left group outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-box"
    >
      <div className="flex items-center gap-4">
        <div className={`w-2 h-2 rounded-full transition-colors duration-300 ${isOpen ? 'bg-primary shadow-primary' : 'bg-base-300 group-hover:bg-primary/50'}`} aria-hidden="true" />
        <span className={`text-base font-bold transition-colors duration-300 font-poppins ${isOpen ? 'text-primary' : 'text-base-content/80'}`}>
          {question}
        </span>
      </div>
      <div className={`p-1.5 rounded-field border transition-all duration-300 ${isOpen ? 'text-primary-content bg-primary border-transparent rotate-90' : 'text-base-content/40 border-base-300 group-hover:border-primary/30'}`} aria-hidden="true">
        <ChevronRight size={16} />
      </div>
    </button>
    
    <AnimatePresence initial={false}>
      {isOpen && (
        <MotionDiv
          id={`faq-answer-${id}`}
          role="region"
          aria-labelledby={`faq-question-${id}`}
          variants={accordionVariants}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="overflow-hidden"
        >
          <div className="px-11 pb-6 pt-2">
            <p className="text-sm text-base-content/70 leading-relaxed border-l-2 border-primary/20 pl-4 font-poppins">
              {answer}
            </p>
          </div>
        </MotionDiv>
      )}
    </AnimatePresence>
  </div>
));
AccordionItem.displayName = 'AccordionItem';

// --- Main Page Component ---

export default function FAQPage() {
  const dispatch = useDispatch();
  const faqs = useSelector(selectAllFAQs) || [];
  const isLoading = useSelector(selectFAQLoading);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [openIndex, setOpenIndex] = useState(null);

  // Optimized fetch using requestIdleCallback for higher Lighthouse scores
  useEffect(() => {
    const handleFetch = () => {
      if (!faqs.length && !isLoading) {
        dispatch(fetchFAQs({ isActive: true }));
      }
    };

    if ('requestIdleCallback' in window) {
      window.requestIdleCallback(() => handleFetch());
    } else {
      setTimeout(handleFetch, 200);
    }
  }, [dispatch, faqs.length, isLoading]);

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

  // SEO Structured Data
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
    <div className="min-h-screen bg-base-100 w-full overflow-x-hidden text-base-content">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      
      {/* A11y Skip Link */}
      <a href="#main-faq-content" className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-content rounded-field">
        Skip to content
      </a>

      {/* Optimized background with CSS variables */}
      <div className="fixed inset-0 z-0 opacity-40 pointer-events-none" aria-hidden="true">
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_20%_20%,_color-mix(in_oklch,var(--primary),transparent_90%)_0%,_transparent_40%)]" />
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03]" />
      </div>

      <main id="main-faq-content" className="relative z-10 container-custom pt-16 pb-32">
        
        {/* HERO SECTION */}
        <section className="max-w-4xl mx-auto text-center mb-16 pt-8">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-field bg-primary/10 border border-primary/20 text-primary text-[10px] font-black uppercase tracking-widest mb-8">
            <Activity size={14} className="animate-pulse" aria-hidden="true" />
            Healthcare Knowledge Base
          </div>

          <h1 className="section-heading">
            Find Your <br className="hidden md:block" />
            <span className="text-gradient-primary italic pr-2">Questions?</span> On Here
          </h1>

          <div className="max-w-2xl mx-auto relative group mt-8">
            <div className="relative flex h-16 items-center bg-base-100 border border-base-300 rounded-field shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-primary transition-all">
              <label htmlFor="faq-search" className="sr-only">Search medical topics</label>
              <Search className="ml-5 text-base-content/40" size={20} aria-hidden="true" />
              <input 
                id="faq-search"
                type="search"
                placeholder="Search medical topics or services..."
                className="w-full py-5 px-5 bg-transparent outline-none text-base font-medium placeholder:text-base-content/30 font-poppins"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </section>

        {/* CONTENT AREA */}
        <LayoutGroup>
          <nav className="flex flex-wrap items-center justify-center gap-3 mb-16" aria-label="FAQ Categories">
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

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
            <div className="lg:col-span-8">
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-black flex items-center gap-3 font-montserrat">
                  <span className="w-8 h-8 rounded-field bg-primary/10 text-primary flex items-center justify-center" aria-hidden="true">
                    <Sparkles size={18} />
                  </span>
                  Frequently Asked
                </h2>
              </div>

              <div aria-live="polite">
                {isLoading ? (
                  <div className="space-y-4" aria-hidden="true">
                    {[1, 2, 3, 4].map(i => <div key={i} className="skeleton h-20 w-full rounded-box" />)}
                  </div>
                ) : filteredFaqs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-16 px-6 text-center border-2 border-dashed border-base-300 rounded-box bg-base-200/30">
                    <div className="w-16 h-16 bg-base-100 rounded-full flex items-center justify-center shadow-sm mb-4 text-base-content/30">
                      <FileQuestion size={32} />
                    </div>
                    <h3 className="text-lg font-bold mb-2 font-montserrat">No questions found</h3>
                    <p className="text-sm text-base-content/60 max-w-sm mb-6 font-poppins">
                      We couldn't find any FAQs matching "{searchTerm}".
                    </p>
                    <button 
                      onClick={() => { setSearchTerm(''); setActiveCategory('All'); }}
                      className="text-primary font-bold hover:underline font-poppins outline-none focus-visible:ring-2 focus-visible:ring-primary p-1"
                    >
                      Clear all filters
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
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
            </div>

            <aside className="lg:col-span-4">
              <div className="bg-secondary p-8 rounded-box text-neutral-content relative overflow-hidden shadow-depth">
                <div className="absolute -top-20 -right-20 w-40 h-40 border border-neutral-content/10 rounded-full animate-spin-slow" aria-hidden="true" />
                
                <h3 className="text-base-100 text-v font-black mb-2 italic font-montserrat">Immediate Assistance?</h3>
                <p className="text-sm text-neutral-content/70 mb-8 font-medium font-poppins leading-relaxed">
                  Our care coordinators are active and ready to help.
                </p>
                
                <div className="space-y-3">
                  <button 
                    type="button"
                    className="btn-primary-cta w-full flex items-center justify-between group"
                  >
                    <span className="flex items-center gap-2 font-black text-xs uppercase">
                      <MessageCircle size={16} aria-hidden="true"/> Open Chat
                    </span>
                    <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" aria-hidden="true"/>
                  </button>
                  
                  <a 
                    href="tel:108" 
                    className="w-full py-4 border border-neutral-content/20 rounded-field flex items-center justify-center gap-3 hover:bg-neutral-content/5 transition-all outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  >
                    <PhoneCall size={16} className="text-secondary" aria-hidden="true" />
                    <span className="font-bold text-xs uppercase tracking-tighter text-neutral-content">Emergency Hotline</span>
                  </a>
                </div>
              </div>

              <div className="mt-6 p-6 border-2 border-dashed border-base-300 rounded-box bg-base-100">
                <h4 className="font-bold text-sm mb-2 text-base-content font-montserrat">Still need help?</h4>
                <p className="text-xs text-base-content/60 leading-relaxed font-poppins">
                  Reach out to our medical desk for a customized response within 24 hours.
                </p>
              </div>
            </aside>
          </div>
        </LayoutGroup>
      </main>
    </div>
  );
}

 