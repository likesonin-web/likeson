'use client';
import { memo, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Phone, Car, User, MapPin, Navigation2, AlertCircle, Star } from 'lucide-react';

const DriverInfoCard = memo(function DriverInfoCard({ driver, liveLocation }) {
  if (!driver) {
    return (
      <div className="card p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="skeleton w-12 h-12 rounded-full" />
          <div className="flex-1">
            <div className="skeleton h-4 w-32 mb-2" />
            <div className="skeleton h-3 w-24" />
          </div>
        </div>
      </div>
    );
  }

  const { driverSnapshot, vehicleSnapshot } = driver;
  const name    = driverSnapshot?.legalName ?? driverSnapshot?.name ?? 'Driver';
  const phone   = driverSnapshot?.phone ?? null;
  const rating  = driverSnapshot?.rating ?? null;
  const photo   = driverSnapshot?.photoUrl ?? null;
  const regNum  = vehicleSnapshot?.registrationNumber ?? null;
  const vehicle = [vehicleSnapshot?.make, vehicleSnapshot?.model, vehicleSnapshot?.color]
    .filter(Boolean).join(' · ');

  const handleCall = useCallback(() => {
    if (phone) window.open(`tel:${phone}`, '_self');
  }, [phone]);

  const handleNavigate = useCallback(() => {
    if (!liveLocation) return;
    window.open(`https://maps.google.com/?q=${liveLocation.lat},${liveLocation.lng}`, '_blank', 'noopener');
  }, [liveLocation]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className="card p-4 group"
    >
      {/* Header */}
      <div className="flex items-start gap-3 mb-3">
        {/* Avatar */}
        <div className="relative w-12 h-12 rounded-full overflow-hidden bg-primary/10 flex-shrink-0 border-2 border-primary/20">
          {photo ? (
            <img src={photo} alt={name} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User size={22} className="text-primary/70" />
            </div>
          )}
          {/* Online pulse */}
          <span className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-base-100" />
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
          {phone && <p className="text-xs text-base-content/50 font-poppins">{phone}</p>}
        </div>
      </div>

      {/* Vehicle */}
      {(vehicle || regNum) && (
        <div className="mb-3 px-3 py-2 bg-base-200 rounded-lg border border-base-300">
          <div className="flex items-center gap-2 text-xs text-base-content/70">
            <Car size={13} className="text-primary flex-shrink-0" />
            <span className="font-medium truncate">{vehicle || 'Vehicle'}</span>
          </div>
          {regNum && (
            <p className="text-xs font-bold text-base-content mt-0.5 font-montserrat tracking-wider">{regNum}</p>
          )}
        </div>
      )}

      {/* Live stats */}
      {liveLocation && (
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center px-2 py-1.5 bg-base-200 rounded-lg border border-base-300">
            <p className="text-xs text-base-content/50 mb-0.5">Speed</p>
            <p className="font-bold text-sm text-base-content">{Math.round(liveLocation.speedKmh ?? 0)}</p>
            <p className="text-xs text-base-content/40">km/h</p>
          </div>
          <div className="text-center px-2 py-1.5 bg-base-200 rounded-lg border border-base-300">
            <p className="text-xs text-base-content/50 mb-0.5">Heading</p>
            <Navigation2
              size={16}
              className="mx-auto text-primary"
              style={{ transform: `rotate(${liveLocation.heading ?? 0}deg)` }}
            />
            <p className="text-xs text-base-content/40">{Math.round(liveLocation.heading ?? 0)}°</p>
          </div>
          <div className="text-center px-2 py-1.5 bg-base-200 rounded-lg border border-base-300">
            <p className="text-xs text-base-content/50 mb-0.5">Status</p>
            <span className="w-2 h-2 bg-success rounded-full inline-block" />
            <p className="text-xs text-base-content/40">Live</p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2">
        {phone && (
          <button
            onClick={handleCall}
            className="btn btn-sm btn-primary flex-1"
            aria-label={`Call ${name}`}
          >
            <Phone size={13} />
            Call
          </button>
        )}
        {liveLocation && (
          <button
            onClick={handleNavigate}
            className="btn btn-sm btn-outline flex-1"
            aria-label="Navigate to driver"
          >
            <MapPin size={13} />
            Navigate
          </button>
        )}
      </div>
    </motion.div>
  );
});

export default DriverInfoCard;