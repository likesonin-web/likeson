'use client';
import { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Stethoscope, Building2, FlaskConical, Pill, Star, MapPin, ArrowRight } from 'lucide-react';

const fadeUp = { hidden:{opacity:0,y:10}, visible:{opacity:1,y:0,transition:{duration:0.25}} };
const stagger = { visible:{ transition:{ staggerChildren:0.05 } } };

// Map item type → route prefix
const ROUTE_MAP = {
  doctor:   (item) => `/doctors/${item._id}`,
  hospital: (item) => `/hospitals/${item.slug || item._id}`,
  lab:      (item) => `/labs/customer/${item.labCode || item._id}`,
  medicine: (item) => `/pharmacy/buy-medicines/${item.slug || item._id}`,
};

// Fallback: derive type from section key if item.type absent
const KEY_TO_TYPE = {
  doctors:   'doctor',
  hospitals: 'hospital',
  labs:      'lab',
  medicines: 'medicine',
};

export default memo(function GlobalResults({ data }) {
  const { doctors=[], hospitals=[], labs=[], medicines=[] } = data;
  const sections = [
    { key:'doctors',   label:'Doctors',   Icon:Stethoscope,  items:doctors,   color:'info' },
    { key:'hospitals', label:'Hospitals', Icon:Building2,    items:hospitals, color:'secondary' },
    { key:'labs',      label:'Labs',      Icon:FlaskConical, items:labs,      color:'accent' },
    { key:'medicines', label:'Medicines', Icon:Pill,         items:medicines, color:'success' },
  ].filter((s) => s.items.length > 0);

  return (
    <div className="mt-4 space-y-8">
      {sections.map(({ key, label, Icon, items, color }) => (
        <motion.section key={key} variants={stagger} initial="hidden" animate="visible" aria-label={label}>
          <div className="flex items-center justify-between mb-3">
            <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-base-content/60">
              <Icon size={15} className={`text-${color}`} />{label}
              <span className="badge badge-xs ml-1">{items.length}</span>
            </h2>
          </div>
          <div className="space-y-2">
            {items.map((item) => (
              <motion.div key={item._id} variants={fadeUp}>
                <GlobalResultRow item={item} color={color} sectionKey={key} />
              </motion.div>
            ))}
          </div>
        </motion.section>
      ))}
    </div>
  );
});

const GlobalResultRow = memo(({ item, color, sectionKey }) => {
  const name   = item.name || item.brandName || item.labName || 'Unknown';
  const sub    = item.specialization || item.hospitalType || item.labType || item.genericName || item.category;
  const rating = item.rating?.averageRating || item.averageRating;
  const city   = item.address?.city || item.registeredAddress?.city;

  // Resolve type: prefer item.type, fall back to sectionKey mapping
  const type = item.type || KEY_TO_TYPE[sectionKey];
  const href = ROUTE_MAP[type]?.(item) ?? `/${type}s/${item._id}`;

  return (
    <article className={`card px-4 py-3 flex items-center gap-3 hover:border-${color}/30 group`}>
      <div className={`flex-shrink-0 w-9 h-9 rounded-full bg-${color}/10 flex items-center justify-center`}>
        <span className={`text-${color} font-bold text-sm`}>{name[0]}</span>
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-base-content truncate">{name}</p>
        {sub && <p className="text-xs text-base-content/50 truncate">{sub}</p>}
      </div>
      <div className="flex items-center gap-3 flex-shrink-0">
        {rating > 0 && (
          <span className="flex items-center gap-1 text-xs text-base-content/60">
            <Star size={11} className="text-warning fill-warning" />{rating.toFixed(1)}
          </span>
        )}
        {city && (
          <span className="hidden sm:flex items-center gap-1 text-xs text-base-content/40">
            <MapPin size={11} />{city}
          </span>
        )}
        <Link
          href={href}
          className="btn btn-xs opacity-0 group-hover:opacity-100 transition-opacity gap-1"
          style={{ background:`color-mix(in srgb, var(--${color}), transparent 85%)`, color:`var(--${color})` }}
        >
          View <ArrowRight size={11} />
        </Link>
      </div>
    </article>
  );
});
GlobalResultRow.displayName = 'GlobalResultRow';