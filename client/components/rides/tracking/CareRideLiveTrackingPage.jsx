'use client';
/**
 * CareRideLiveTrackingPage
 * app/care-assistant/rides/[rideId]/tracking/page.jsx
 *
 * Supports:
 *  TYPE 1 — Care Assistant Only Ride  (bookingType: 'care_assistant')
 *  TYPE 2 — Full Care Ride            (bookingType: 'full_care_ride')
 *
 * Architecture:
 *  - useRideTracking (socket + Redux) for live state
 *  - useGoogleMaps  for map instance
 *  - Desktop: split layout — map top, panels bottom
 *  - Mobile:  map + bottom sheet
 */

import { useMemo, useCallback, useRef, useEffect, memo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useSelector } from 'react-redux';

// ── Hooks ─────────────────────────────────────────────────────────────────────
import useRideTracking from '@/components/rides/tracking/useRideTracking';
import { useSocket }   from '@/context/SocketProvider';

// ── Redux ─────────────────────────────────────────────────────────────────────
import {
  selectTrackingData,
  selectRideLoading,
} from '@/redux/slices/rideRequestSlice';

// ── Components ────────────────────────────────────────────────────────────────
import RideHeader              from '@/components/rides/tracking/RideHeader';
import RideLiveMap             from '@/components/rides/tracking/RideLiveMap';
import DriverInfoCard          from '@/components/rides/tracking/DriverInfoCard';
import PatientInfoCard         from '@/components/rides/tracking/PatientInfoCard';
import CareAssistantInfoCard   from '@/components/rides/tracking/CareAssistantInfoCard';
import RideEtaCard             from '@/components/rides/tracking/RideEtaCard';
import HospitalEtaCard         from '@/components/rides/tracking/HospitalEtaCard';
import RideMilestoneTimeline   from '@/components/rides/tracking/RideMilestoneTimeline';
import RideStatusTracker       from '@/components/rides/tracking/RideStatusTracker';
import RideSummaryCard         from '@/components/rides/tracking/RideSummaryCard';
import RideActivityFeed        from '@/components/rides/tracking/RideActivityFeed';
import RideSosPanel            from '@/components/rides/tracking/RideSosPanel';
import MobileTrackingSheet     from '@/components/rides/tracking/MobileTrackingSheet';

// ── Google Maps hook ──────────────────────────────────────────────────────────
// Import from your existing hook path. Adjust if different.
// import { useGoogleMaps } from '@/hooks/useGoogleMaps';

/**
 * Placeholder useGoogleMaps if not yet importable from this context.
 * Replace with real hook from your codebase.
 */
function useGoogleMaps() {
  return { isLoaded: typeof window !== 'undefined' && !!window.google, mapRef: { current: null } };
}

// ─────────────────────────────────────────────────────────────────────────────
// SKELETON LOADER
// ─────────────────────────────────────────────────────────────────────────────
function TrackingSkeleton() {
  return (
    <div className="h-screen bg-base-100 flex flex-col">
      <div className="h-16 bg-base-200 border-b border-base-300 flex items-center px-4 gap-3">
        <div className="skeleton w-8 h-8 rounded-xl" />
        <div className="flex-1">
          <div className="skeleton h-4 w-32 mb-1.5" />
          <div className="skeleton h-3 w-24" />
        </div>
      </div>
      <div className="flex-1 bg-base-200 skeleton" />
      <div className="h-48 bg-base-100 p-4 space-y-3">
        <div className="skeleton h-12 rounded-xl" />
        <div className="skeleton h-20 rounded-xl" />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────
export default function CareRideLiveTrackingPage() {
  const params   = useParams();
  const router   = useRouter();
  const rideId   = params?.rideId ?? null;

  // ── Maps ─────────────────────────────────────────────────────────────────────
  const { isLoaded, mapRef } = useGoogleMaps();

  // ── Socket ───────────────────────────────────────────────────────────────────
  const { connected, connStatus, triggerSos } = useSocket();

  // ── Tracking hook ────────────────────────────────────────────────────────────
  const tracking = useRideTracking({ rideId, bookingId: null, rideType: 'full_care_ride' });
  // Note: bookingId is set once ride loads (see below)

  const {
    ride,
    tracking: trackingDoc,
    milestones,
    polyline,
    hasActiveSos,
    liveLocation,
    status,
    etaMinutes,
    etaTarget,
    navTarget,
    rideStage,
    hospitalEta,
    careSnapshot,
    caLiveLocation,
    caCurrentStatus,
    caJoined,
    activityFeed,
  } = tracking;

  const loading = useSelector(selectRideLoading);
  const isLoading = loading?.tracking ?? false;

  // Derive key fields from ride
  const bookingId  = ride?.booking      ?? null;
  const rideCode   = ride?.rideCode     ?? null;
  const bookingCode= null; // fetched separately if needed
  const rideType   = ride?.rideType === 'care_assistant' ? 'care_assistant' : 'full_care_ride';
  const isFullCare = rideType === 'full_care_ride';

  // ── Re-init tracking with bookingId once ride loads ───────────────────────
  const bookingIdRef = useRef(null);
  useEffect(() => {
    if (bookingId && bookingId !== bookingIdRef.current) {
      bookingIdRef.current = bookingId;
      // trackingHook already supports bookingId — it re-fetches careSnapshot
      // The hook re-runs when bookingId changes; we do not need to force here
    }
  }, [bookingId]);

  // ── Derive locations ──────────────────────────────────────────────────────
  const driverLoc = useMemo(() => {
    if (!liveLocation) return null;
    return { lat: liveLocation.lat, lng: liveLocation.lng, heading: liveLocation.heading ?? 0, speedKmh: liveLocation.speedKmh ?? 0 };
  }, [liveLocation]);

  const patientLoc = useMemo(() => {
    const c = ride?.pickup?.coordinates;
    if (!c?.length) return null;
    return { lat: c[1], lng: c[0] };
  }, [ride?.pickup]);

  const hospitalLoc = useMemo(() => {
    const hs = careSnapshot?.route?.dropoff?.coordinates ?? ride?.dropoff?.coordinates;
    if (!hs?.length) return null;
    return { lat: hs[1], lng: hs[0] };
  }, [careSnapshot, ride?.dropoff]);

  const caLoc = useMemo(() => {
    if (!caLiveLocation) return null;
    if (caLiveLocation.lat) return { lat: caLiveLocation.lat, lng: caLiveLocation.lng };
    const c = caLiveLocation?.coordinates ?? caLiveLocation;
    if (Array.isArray(c) && c.length === 2) return { lat: c[1], lng: c[0] };
    return null;
  }, [caLiveLocation]);

  // ── SOS handler ───────────────────────────────────────────────────────────
  const handleSos = useCallback((sosType, description) => {
    triggerSos({ bookingId, rideId, sosType, description, lat: driverLoc?.lat, lng: driverLoc?.lng });
  }, [triggerSos, bookingId, rideId, driverLoc]);

  // ── Connection status string ───────────────────────────────────────────────
  const connStatusStr = connStatus ?? (connected ? 'connected' : 'disconnected');

  // ── Loading ───────────────────────────────────────────────────────────────
  if (isLoading && !ride) return <TrackingSkeleton />;

  // ─────────────────────────────────────────────────────────────────────────
  // SHARED PANEL CONTENT — used both desktop right panel + mobile sheet
  // ─────────────────────────────────────────────────────────────────────────
  const PanelContent = (
    <>
      {/* ETA */}
      <RideEtaCard
        etaMinutes={etaMinutes}
        distanceRemainingKm={trackingDoc?.totalDistanceKm}
        currentTarget={navTarget}
        hospitalEta={hospitalEta}
      />

      {/* Hospital ETA banner */}
      {hospitalEta?.etaMinutes != null && (
        <HospitalEtaCard hospitalEta={hospitalEta} />
      )}

      {/* Status tracker */}
      <RideStatusTracker
        status={status}
        rideStage={rideStage}
        activeNavigationTarget={navTarget}
        rideType={rideType}
      />

      {/* Driver */}
      <DriverInfoCard
        driver={ride}
        liveLocation={driverLoc}
      />

      {/* Patient — full care only */}
      {isFullCare && (
        <PatientInfoCard
          booking={{ patientInfo: null, patientLocation: ride?.pickup, bookingType: rideType }}
          currentStatus={status}
        />
      )}

      {/* Care Assistant */}
      <CareAssistantInfoCard
        careAssistantSnapshot={careSnapshot?.careAssistant ?? null}
        caProfile={careSnapshot?.careAssistant ?? null}
        caStatus={caCurrentStatus}
        caLocation={caLoc}
        joinedAt={caJoined?.joinedAt ?? careSnapshot?.careAssistant?.joinedAt}
      />

      {/* Summary */}
      <RideSummaryCard
        ride={ride}
        tracking={trackingDoc}
        booking={null}
      />

      {/* SOS */}
      <RideSosPanel
        onTriggerSos={handleSos}
        hasActiveSos={hasActiveSos}
        bookingId={bookingId}
        rideId={rideId}
      />
    </>
  );

  // Shared left panel content (timeline + activity)
  const LeftPanelContent = (
    <>
      <RideMilestoneTimeline milestones={milestones} />
      <RideActivityFeed events={activityFeed} />
    </>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div
      className="h-screen bg-base-100 flex flex-col overflow-hidden"
      data-theme="care-assistant"
    >
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <RideHeader
        rideCode={rideCode}
        bookingCode={bookingCode}
        status={status}
        rideStage={rideStage}
        activeNavigationTarget={navTarget}
        connStatus={connStatusStr}
        rideType={rideType}
        onBack={() => router.back()}
      />

      {/* ── DESKTOP LAYOUT ─────────────────────────────────────────────────── */}
      <div className="hidden md:flex flex-1 overflow-hidden">

        {/* Map — center, 60% width */}
        <div className="relative flex-1 min-w-0">
          <RideLiveMap
            mapRef={mapRef}
            isLoaded={isLoaded}
            driverLocation={driverLoc}
            patientLocation={patientLoc}
            caLocation={caLoc}
            hospitalLocation={hospitalLoc}
            destLocation={hospitalLoc}
            routePolyline={polyline}
            rideType={rideType}
            rideStatus={status}
          />
        </div>

        {/* Left panel — 260px, scrollable */}
        <div
          className="w-64 xl:w-72 flex-shrink-0 border-r border-base-300 bg-base-100 flex flex-col overflow-y-auto scrollbar-thin"
          style={{ order: -1 }}
        >
          <div className="p-3 space-y-3">
            <h3 className="text-xs font-bold text-base-content/50 uppercase tracking-wider px-1">Activity</h3>
            {LeftPanelContent}
          </div>
        </div>

        {/* Right panel — 320px, scrollable */}
        <div className="w-80 xl:w-96 flex-shrink-0 border-l border-base-300 bg-base-100 overflow-y-auto scrollbar-thin">
          <div className="p-3 space-y-3">
            {PanelContent}
          </div>
        </div>
      </div>

      {/* ── MOBILE LAYOUT ──────────────────────────────────────────────────── */}
      <div className="flex md:hidden flex-1 relative overflow-hidden">
        {/* Map fills screen */}
        <div className="absolute inset-0">
          <RideLiveMap
            mapRef={mapRef}
            isLoaded={isLoaded}
            driverLocation={driverLoc}
            patientLocation={patientLoc}
            caLocation={caLoc}
            hospitalLocation={hospitalLoc}
            destLocation={hospitalLoc}
            routePolyline={polyline}
            rideType={rideType}
            rideStatus={status}
          />
        </div>

        {/* Bottom sheet */}
        <MobileTrackingSheet
          statusStrip={
            <div className="flex items-center gap-2 flex-wrap">
              {etaMinutes != null && (
                <span className="font-montserrat font-extrabold text-base text-primary">
                  {etaMinutes < 1 ? '< 1 min' : `${Math.round(etaMinutes)} min`}
                </span>
              )}
              {status && (
                <span className="text-xs text-base-content/60 font-poppins truncate max-w-[120px]">
                  {status.replace(/_/g, ' ')}
                </span>
              )}
            </div>
          }
        >
          <div className="space-y-3">
            {/* Status tracker on mobile too */}
            <RideStatusTracker
              status={status}
              rideStage={rideStage}
              activeNavigationTarget={navTarget}
              rideType={rideType}
            />
            {PanelContent}
            {LeftPanelContent}
          </div>
        </MobileTrackingSheet>
      </div>
    </div>
  );
}