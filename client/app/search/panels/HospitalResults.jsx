'use client';
/**
 * HospitalResults.jsx
 */

import { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, MapPin, CheckCircle2, Shield, Clock, HeartPulse, ArrowRight, Bed } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

export default memo(function HospitalResults({ data }) {
  const hospitals = data?.data ?? [];
  if (!hospitals.length) return null;

  return (
    <motion.ul variants={stagger} initial="hidden" animate="visible" className="mt-4 space-y-3" aria-label="Hospital results">
      {hospitals.map((h) => <motion.li key={h._id} variants={fadeUp}><HospitalCard h={h} /></motion.li>)}
    </motion.ul>
  );
});

const HospitalCard = memo(({ h }) => {
  const rating = h.rating?.averageRating ?? 0;
  const img = h.images?.[0]?.url || h.logo;

  return (
    <article className="card p-4 md:p-5 flex gap-4 group" aria-label={`Hospital ${h.name}`}>
      <div className="flex-shrink-0 w-16 h-16 rounded-[var(--r-box)] overflow-hidden bg-base-300 ring-2 ring-base-300 group-hover:ring-primary/30 transition-all">
        {img ? (
          <Image src={img} alt={h.name} width={64} height={64} className="object-cover w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-secondary/10 text-secondary font-bold text-lg">
            {h.name?.[0] ?? 'H'}
          </div>
        )}
      </div>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-base font-bold text-base-content truncate">{h.name}</h3>
          {h.isVerified && <CheckCircle2 size={15} className="text-primary flex-shrink-0" aria-label="Verified" />}
        </div>
        <p className="text-xs text-secondary font-medium mt-0.5">{h.hospitalType} · {h.managementModel}</p>

        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-base-content/60">
          {rating > 0 && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-warning fill-warning" />
              <span className="font-semibold text-base-content">{rating.toFixed(1)}</span>
            </span>
          )}
          {h.address?.city && <span className="flex items-center gap-1"><MapPin size={11} />{h.address.city}</span>}
          {h.distanceKm != null && <span className="flex items-center gap-1 text-primary"><MapPin size={11} />{h.distanceKm.toFixed(1)} km</span>}
          {h.bedCount?.total > 0 && <span className="flex items-center gap-1"><Bed size={11} />{h.bedCount.total} beds{h.bedCount.icu > 0 ? ` (${h.bedCount.icu} ICU)` : ''}</span>}
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2">
          {h.is24x7      && <FeatureBadge label="24×7" icon={<Clock size={10}/>} />}
          {h.hasICU      && <FeatureBadge label="ICU" />}
          {h.isEmergencyReady && <FeatureBadge label="Emergency" icon={<HeartPulse size={10}/>} color="error" />}
          {h.hasPharmacy && <FeatureBadge label="Pharmacy" />}
          {h.accreditations?.slice(0,2).map((a) => <span key={a} className="badge badge-xs badge-info">{a}</span>)}
        </div>
      </div>

      <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2">
        <Link href={`/hospitals/${h.slug || h._id}`} className="btn btn-secondary btn-sm gap-1 group-hover:gap-2 transition-all duration-200" aria-label={`View ${h.name}`}>
          View <ArrowRight size={13} />
        </Link>
        {h.contact?.phone && <p className="text-xs text-base-content/40">{h.contact.phone}</p>}
      </div>
    </article>
  );
});
HospitalCard.displayName = 'HospitalCard';

const FeatureBadge = memo(({ label, icon, color = 'primary' }) => (
  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${color}/10 text-${color} border border-${color}/20`}>
    {icon}{label}
  </span>
));
FeatureBadge.displayName = 'FeatureBadge';