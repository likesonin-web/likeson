'use client';

import { memo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Star, MapPin, CheckCircle2, Video, Home, UserRound, ArrowRight, Wifi } from 'lucide-react';

const fadeUp = {
  hidden:  { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } },
};

const stagger = {
  visible: { transition: { staggerChildren: 0.07 } },
};

export default memo(function DoctorResults({ data, query }) {
  const doctors = data?.data ?? [];
  if (!doctors.length) return null;

  return (
    <motion.ul
      variants={stagger}
      initial="hidden"
      animate="visible"
      className="mt-4 space-y-3"
      aria-label="Doctor search results"
    >
      {doctors.map((doc) => (
        <motion.li key={doc._id} variants={fadeUp}>
          <DoctorCard doc={doc} query={query} />
        </motion.li>
      ))}
    </motion.ul>
  );
});

const DoctorCard = memo(({ doc }) => {
  const rating = doc.rating?.averageRating ?? 0;
  const reviews = doc.rating?.totalReviews ?? 0;

  return (
    <article className="card p-4 md:p-5 flex gap-4 group" aria-label={`Doctor ${doc.name}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="relative w-16 h-16 rounded-full overflow-hidden bg-base-300 ring-2 ring-base-300 group-hover:ring-primary/30 transition-all duration-200">
          {doc.avatar || doc.profilePhotoUrl ? (
            <Image
              src={doc.profilePhotoUrl || doc.avatar}
              alt={doc.name || 'Doctor'}
              fill
              sizes="64px"
              className="object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center bg-primary/10 text-primary font-bold text-lg">
              {doc.name?.[0] ?? 'D'}
            </div>
          )}
        </div>
        {doc.isOnline && (
          <div className="flex justify-center mt-1">
            <span className="flex items-center gap-1 text-xs text-success font-semibold">
              <span className="status-dot status-dot-success animate-pulse" />
              Online
            </span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <h3 className="text-base font-bold text-base-content truncate">{doc.name}</h3>
          {doc.isVerified && (
            <CheckCircle2 size={15} className="text-primary flex-shrink-0 mt-0.5" aria-label="Verified" />
          )}
        </div>
        <p className="text-sm text-primary font-medium mt-0.5">{doc.specialization}</p>

        <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-base-content/60">
          {doc.experienceYears != null && (
            <span>{doc.experienceYears}+ yrs exp</span>
          )}
          {rating > 0 && (
            <span className="flex items-center gap-1">
              <Star size={12} className="text-warning fill-warning" />
              <span className="font-semibold text-base-content">{rating.toFixed(1)}</span>
              {reviews > 0 && <span>({reviews})</span>}
            </span>
          )}
          {doc.hospital?.city && (
            <span className="flex items-center gap-1">
              <MapPin size={11} /> {doc.hospital.city}
            </span>
          )}
          {doc.distanceKm != null && (
            <span className="flex items-center gap-1">
              <MapPin size={11} className="text-primary" />
              {doc.distanceKm.toFixed(1)} km
            </span>
          )}
        </div>

        {/* Consultation types */}
        <div className="flex flex-wrap gap-2 mt-3">
          {doc.consultationTypes?.inPerson  && <ConsultTag icon={<UserRound size={11}/>} label="In-Person" />}
          {doc.consultationTypes?.video     && <ConsultTag icon={<Video size={11}/>}     label="Video"     color="info" />}
          {doc.consultationTypes?.homeVisit && <ConsultTag icon={<Home size={11}/>}      label="Home"      color="success" />}
          {doc.languagesSpoken?.slice(0, 2).map((l) => (
            <span key={l} className="badge badge-xs border-base-300 text-base-content/50">{l}</span>
          ))}
        </div>
      </div>

      {/* CTA */}
      <div className="flex-shrink-0 flex flex-col items-end gap-2 justify-between">
        {doc.fees?.inPerson && (
          <p className="text-sm font-bold text-base-content">
            ₹{doc.fees.inPerson}
            <span className="text-xs font-normal text-base-content/50"> /visit</span>
          </p>
        )}
        <Link
          href={`/doctors/${doc._id}`}
          className="btn btn-primary btn-sm gap-1 group-hover:gap-2 transition-all duration-200"
          aria-label={`Book appointment with ${doc.name}`}
        >
          Book <ArrowRight size={13} />
        </Link>
        {doc.hospital?.name && (
          <p className="text-xs text-base-content/40 text-right max-w-[130px] truncate">{doc.hospital.name}</p>
        )}
      </div>
    </article>
  );
});
DoctorCard.displayName = 'DoctorCard';

const ConsultTag = memo(({ icon, label, color = 'primary' }) => (
  <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${color}/10 text-${color} border border-${color}/20`}>
    {icon}{label}
  </span>
));
ConsultTag.displayName = 'ConsultTag';