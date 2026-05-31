'use client';
import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Phone, User, Clock, MapPin, Star, Briefcase } from 'lucide-react';

const CA_STATUS_LABELS = {
  not_joined:          'Not Joined',
  en_route_to_pickup:  'En Route',
  at_pickup:           'At Pickup',
  in_ride:             'In Ride',
  departed:            'Departed',
};

const CA_STATUS_COLORS = {
  not_joined:         'bg-base-300 text-base-content/50 border-base-300',
  en_route_to_pickup: 'bg-info/10 text-info border-info/30',
  at_pickup:          'bg-warning/10 text-warning border-warning/30',
  in_ride:            'bg-success/10 text-success border-success/30',
  departed:           'bg-secondary/10 text-secondary border-secondary/30',
};

const CareAssistantInfoCard = memo(function CareAssistantInfoCard({
  careAssistantSnapshot,
  caProfile,
  caStatus = 'not_joined',
  caLocation,
  joinedAt,
}) {
  const name      = caProfile?.fullName ?? careAssistantSnapshot?.name ?? 'Care Assistant';
  const phone     = caProfile?.phone    ?? careAssistantSnapshot?.phone ?? null;
  const photo     = caProfile?.photoUrl ?? careAssistantSnapshot?.photoUrl ?? null;
  const rating    = caProfile?.performance?.averageRating ?? null;
  const specs     = caProfile?.specializations ?? [];
  const statusLbl = CA_STATUS_LABELS[caStatus] ?? caStatus ?? '—';
  const statusCls = CA_STATUS_COLORS[caStatus] ?? CA_STATUS_COLORS.not_joined;

  const handleCall = useCallback(() => {
    if (phone) window.open(`tel:${phone}`, '_self');
  }, [phone]);

  if (!careAssistantSnapshot && !caProfile) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 }}
      className="card p-4"
    >
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-secondary/10 border-2 border-secondary/20 flex-shrink-0">
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={22} className="text-secondary/70" />
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <h4 className="font-semibold text-sm text-base-content truncate">{name}</h4>
            {rating && (
              <span className="inline-flex items-center gap-0.5 text-xs text-warning font-medium">
                <Star size={10} fill="currentColor" />
                {rating.toFixed(1)}
              </span>
            )}
          </div>
          {phone && <p className="text-xs text-base-content/50">{phone}</p>}
          {/* Status */}
          <span className={`mt-1 inline-flex text-xs px-2 py-0.5 rounded-full border font-medium ${statusCls}`}>
            {statusLbl}
          </span>
        </div>
      </div>

      {/* Specializations */}
      {specs.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {specs.slice(0, 3).map(s => (
            <span key={s} className="px-2 py-0.5 rounded-full bg-secondary/10 border border-secondary/20 text-xs text-secondary font-medium">
              {s}
            </span>
          ))}
        </div>
      )}

      {/* Joined time */}
      {joinedAt && (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50 mb-3">
          <Clock size={11} />
          Joined {new Date(joinedAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}

      {/* Current location */}
      {caLocation && (
        <div className="flex items-center gap-1.5 text-xs text-base-content/50 mb-3">
          <MapPin size={11} className="text-secondary" />
          Live location active
        </div>
      )}

      {/* Call button */}
      {phone && (
        <button onClick={handleCall} className="btn btn-sm w-full btn-outline border-secondary/30 text-secondary hover:bg-secondary hover:text-secondary-content" aria-label={`Call ${name}`}>
          <Phone size={13} />
          Call Care Assistant
        </button>
      )}
    </motion.div>
  );
});

export default CareAssistantInfoCard;