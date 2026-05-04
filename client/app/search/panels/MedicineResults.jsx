'use client';
import { memo } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Pill, ShoppingCart, AlertTriangle, CheckCircle2 } from 'lucide-react';

const fadeUp = { hidden:{opacity:0,y:12}, visible:{opacity:1,y:0,transition:{duration:0.28,ease:[0.22,1,0.36,1]}} };
const stagger = { visible:{ transition:{ staggerChildren:0.07 } } };

export default memo(function MedicineResults({ data }) {
  const medicines = data?.data ?? [];
  if (!medicines.length) return null;
  return (
    <motion.ul variants={stagger} initial="hidden" animate="visible"
      className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3"
      aria-label="Medicine results"
    >
      {medicines.map((m) => <motion.li key={m._id} variants={fadeUp}><MedicineCard med={m} /></motion.li>)}
    </motion.ul>
  );
});

const MedicineCard = memo(({ med }) => {
  const primaryImg = med.images?.find((i) => i.isPrimary) || med.images?.[0];

  return (
    <article className="card p-4 flex gap-3 group" aria-label={`Medicine ${med.brandName || med.name}`}>
      <div className="flex-shrink-0 w-14 h-14 rounded-[var(--r-box)] overflow-hidden bg-success/10 flex items-center justify-center ring-2 ring-base-300 group-hover:ring-success/40 transition-all">
        {primaryImg?.url
          ? <img src={primaryImg.url} alt={med.name} className="w-full h-full object-contain p-1" />
          : <Pill size={24} className="text-success" />}
      </div>

      <div className="flex-1 min-w-0">
        <h3 className="text-sm font-bold text-base-content truncate">{med.brandName || med.name}</h3>
        {med.genericName && <p className="text-xs text-base-content/50 truncate">{med.genericName}</p>}
        <div className="flex flex-wrap items-center gap-2 mt-1.5">
          <span className="badge badge-xs border-base-300 text-base-content/50">{med.category}</span>
          {med.schedule && med.schedule !== 'None' && (
            <span className="badge badge-warning badge-xs flex items-center gap-0.5">
              <AlertTriangle size={9} /> Schedule {med.schedule}
            </span>
          )}
          {med.isAvailable
            ? <span className="flex items-center gap-1 text-xs text-success font-medium"><CheckCircle2 size={11} />In Stock</span>
            : <span className="text-xs text-error font-medium">Out of Stock</span>
          }
        </div>
        {med.manufacturer && <p className="text-xs text-base-content/40 mt-1 truncate">{med.manufacturer}</p>}
      </div>

      <div className="flex-shrink-0 flex flex-col items-end justify-between gap-2">
        {med.mrp != null && (
          <p className="text-sm font-bold text-base-content">
            ₹{med.mrp}
            {med.packaging && <span className="text-xs font-normal text-base-content/40 ml-1">{med.packaging}</span>}
          </p>
        )}
        {med.isPrescriptionRequired && (
          <span className="text-xs text-warning font-semibold">Rx required</span>
        )}
        <Link
          href={`/buy-medicines/${med.slug || med._id}`}
          className="btn btn-success btn-sm gap-1"
          aria-label={`View ${med.brandName || med.name}`}
        >
          <ShoppingCart size={13} /> View
        </Link>
      </div>
    </article>
  );
});
MedicineCard.displayName = 'MedicineCard';