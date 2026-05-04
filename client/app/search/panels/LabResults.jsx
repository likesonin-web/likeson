'use client';
import { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, MapPin, CheckCircle2, Home, FlaskConical, ArrowRight } from 'lucide-react';

const fadeUp = { hidden:{opacity:0,y:12}, visible:{opacity:1,y:0,transition:{duration:0.28,ease:[0.22,1,0.36,1]}} };
const stagger = { visible:{ transition:{ staggerChildren:0.07 } } };

export default memo(function LabResults({ data }) {
  const labs = data?.data ?? [];
  if (!labs.length) return null;
  return (
    <motion.ul variants={stagger} initial="hidden" animate="visible" className="mt-4 space-y-3" aria-label="Lab results">
      {labs.map((l) => <motion.li key={l._id} variants={fadeUp}><LabCard lab={l} /></motion.li>)}
    </motion.ul>
  );
});

const LabCard = memo(({ lab }) => (
  <article className="card p-4 md:p-5 flex gap-4 group" aria-label={`Lab ${lab.labName}`}>
    <div className="flex-shrink-0 w-16 h-16 rounded-[var(--r-box)] overflow-hidden bg-base-300 ring-2 ring-base-300 group-hover:ring-accent/40 transition-all flex items-center justify-center">
      {lab.logoUrl
        ? <img src={lab.logoUrl} alt={lab.labName} className="w-full h-full object-cover" />
        : <FlaskConical size={26} className="text-accent" />}
    </div>

    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <h3 className="text-base font-bold text-base-content truncate">{lab.labName}</h3>
        {lab.isVerified && <CheckCircle2 size={15} className="text-primary flex-shrink-0" />}
        {lab.isFeatured && <span className="badge badge-warning badge-xs">Featured</span>}
      </div>
      <p className="text-xs text-accent font-medium mt-0.5">{lab.labType} · {lab.ownershipType}</p>

      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-base-content/60">
        {lab.averageRating > 0 && (
          <span className="flex items-center gap-1">
            <Star size={12} className="text-warning fill-warning" />
            <span className="font-semibold text-base-content">{lab.averageRating.toFixed(1)}</span>
            {lab.totalReviews > 0 && <span>({lab.totalReviews})</span>}
          </span>
        )}
        {lab.registeredAddress?.city && <span className="flex items-center gap-1"><MapPin size={11} />{lab.registeredAddress.city}</span>}
        {lab.distanceKm != null && <span className="flex items-center gap-1 text-accent"><MapPin size={11} />{lab.distanceKm.toFixed(1)} km</span>}
        {lab.activeTestCount > 0 && <span>{lab.activeTestCount} tests</span>}
      </div>

      <div className="flex flex-wrap gap-1.5 mt-2">
        {(lab.sampleCollectionMode === 'Home Collection' || lab.sampleCollectionMode === 'Both') && (
          <span className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-success/10 text-success border border-success/20">
            <Home size={10} /> Home Collection
          </span>
        )}
        {lab.accreditations?.slice(0,2).map((a) => (
          <span key={a.body} className="badge badge-xs badge-info">{a.body}</span>
        ))}
        {lab.tags?.slice(0,2).map((t) => (
          <span key={t} className="badge badge-xs border-base-300 text-base-content/40">{t}</span>
        ))}
      </div>
    </div>

    <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2">
      {lab.homeCollectionFee != null && (
        <p className="text-xs text-base-content/50">Home fee: <span className="font-semibold text-base-content">₹{lab.homeCollectionFee}</span></p>
      )}
      <Link href={`/labs/${lab.labCode || lab._id}`} className="btn btn-sm gap-1 group-hover:gap-2 transition-all" style={{ background:'var(--accent)', color:'var(--accent-content)' }}>
        Book <ArrowRight size={13} />
      </Link>
    </div>
  </article>
));
LabCard.displayName = 'LabCard';