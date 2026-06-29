'use client';

/**
 * CareAssistantLiveTracking.jsx
 *
 * Live tracking page for the Care Assistant (CA) side of the platform.
 * Booking-type aware:
 *
 *   bookingType === 'care_assistant'  (CA-only booking, no separate vehicle)
 *     -> CA's own position is "the ride." Map shows CA -> patient route.
 *     phase: 'standalone'
 *
 *   bookingType === 'full_care_ride'  (doctor + transport + CA combined)
 *     -> Two phases:
 *        'navigate_to_jp'    CA travels independently to the calculated
 *                            Join Point. Map shows CA marker, driver marker,
 *                            join-point flag, and CA's own route to it.
 *        'in_vehicle'        CA has boarded. Map switches to driver-tracking
 *                            mode (CA marker removed, driver's route to the
 *                            hospital takes over) — this is the exact
 *                            `caViewMode === 'driver_tracking_only'` switch
 *                            the rest of the codebase already models.
 *
 * Viewable by: the CA themself (push their own GPS), the customer, or an
 * admin (both read-only — no GPS push, no status-change buttons beyond SOS).
 *
 * Built on:
 *   useCareAssistantTracking  — data + sockets + GPS push + actions
 *   useGoogleMapsLoader       — singleton Maps JS SDK loader
 *   useMapCamera              — follow/recenter/tilt camera
 *   useCareAssistantMarker    — CA's own marker (purple)
 *   useDriverMarker           — driver marker + static pickup/dropoff/JP pins
 *   useRouteRenderer          — CA route + driver route polylines
 *   useVoiceNavigation        — proximity announcements (optional, muteable)
 */

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSelector } from 'react-redux';

import { useGoogleMapsLoader } from '@/hooks/useGoogleMapsLoader';
import { useMapCamera } from '@/hooks/useMapCamera';
import { useDriverMarker, createStaticMarker } from '@/hooks/useDriverMarker';
import { useCareAssistantMarker } from '@/hooks/useCareAssistantMarker';
import { useRouteRenderer } from '@/hooks/useRouteRenderer';
import { useVoiceNavigation } from '@/hooks/useVoiceNavigation';
import { useCareAssistantTracking } from '@/hooks/useCareAssistantTracking';
import { distanceKm, formatDistance, formatEta } from '@/utils/navigationUtils';

const MAP_ID = process.env.NEXT_PUBLIC_GOOGLE_MAPS_MAP_ID || 'CA_LIVE_TRACKING';
const DEFAULT_CENTER = { lat: 16.506, lng: 80.648 };
const APPROACH_ANNOUNCE_KM = 0.15; // announce once within 150m of destination

const PHASE_LABEL = {
  loading:             'Loading…',
  awaiting_assignment: 'Waiting for assignment',
  standalone:          'En route to patient',
  navigate_to_jp:       'Heading to join point',
  in_vehicle:           'In vehicle — tracking driver',
  other:                'Tracking ride',
};

const STATUS_STEPS = {
  standalone: [
    { key: 'assigned',           label: 'Assigned' },
    { key: 'en_route_to_pickup', label: 'En route' },
    { key: 'at_pickup',          label: 'At patient' },
    { key: 'in_progress',        label: 'In progress' },
    { key: 'completed',          label: 'Completed' },
  ],
  navigate_to_jp: [
    { key: 'en_route_to_pickup', label: 'Heading to JP' },
    { key: 'at_pickup',          label: 'At join point' },
    { key: 'in_ride',            label: 'Boarded' },
  ],
  in_vehicle: [
    { key: 'in_ride',     label: 'In vehicle' },
    { key: 'enroute_hospital', label: 'To hospital' },
    { key: 'hospital_reached', label: 'Arrived' },
  ],
};

// ─────────────────────────────────────────────────────────────────────────────
// Small presentational pieces
// ─────────────────────────────────────────────────────────────────────────────

function TopBar({ bookingCode, phase, onBack }) {
  return (
    <div className="absolute top-0 left-0 right-0 z-20 flex items-center gap-3 px-4 py-3 bg-gradient-to-b from-white/95 to-white/0 backdrop-blur-sm">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-slate-700 active:scale-95 transition"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      <div className="flex flex-col">
        <span className="text-[11px] font-semibold uppercase tracking-wide text-violet-600">
          {PHASE_LABEL[phase] || 'Tracking'}
        </span>
        {bookingCode && <span className="text-xs text-slate-500">#{bookingCode}</span>}
      </div>
    </div>
  );
}

function FloatingControls({ onRecenter, onNorthUp, onZoomIn, onZoomOut, voiceEnabled, onToggleVoice }) {
  const btn = 'flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-md text-slate-700 active:scale-95 transition';
  return (
    <div className="absolute right-3 bottom-44 z-20 flex flex-col gap-2">
      <button type="button" className={btn} onClick={onToggleVoice} aria-label="Toggle voice announcements">
        {voiceEnabled ? '🔊' : '🔇'}
      </button>
      <button type="button" className={btn} onClick={onZoomIn} aria-label="Zoom in">+</button>
      <button type="button" className={btn} onClick={onZoomOut} aria-label="Zoom out">−</button>
      <button type="button" className={btn} onClick={onNorthUp} aria-label="Reset to north-up">⟲</button>
      <button
        type="button"
        onClick={onRecenter}
        aria-label="Recenter map"
        className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-600 text-white shadow-lg active:scale-95 transition"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><circle cx="12" cy="12" r="3" /><path d="M12 2v4M12 18v4M2 12h4M18 12h4" stroke="currentColor" strokeWidth="2" /></svg>
      </button>
    </div>
  );
}

function Banner({ tone = 'warning', children }) {
  const tones = {
    warning: 'bg-amber-50 text-amber-800 border-amber-200',
    danger:  'bg-red-50 text-red-700 border-red-200',
    info:    'bg-violet-50 text-violet-700 border-violet-200',
  };
  return (
    <div className={`absolute top-16 left-3 right-3 z-20 rounded-xl border px-3 py-2 text-sm font-medium shadow-sm ${tones[tone]}`}>
      {children}
    </div>
  );
}

function StatusTimeline({ steps, activeKey }) {
  const activeIdx = Math.max(0, steps.findIndex((s) => s.key === activeKey));
  return (
    <div className="flex items-center w-full px-1">
      {steps.map((step, i) => (
        <div key={step.key} className="flex items-center flex-1 last:flex-none">
          <div className="flex flex-col items-center gap-1">
            <div
              className={`h-2.5 w-2.5 rounded-full ${
                i <= activeIdx ? 'bg-violet-600' : 'bg-slate-200'
              }`}
            />
            <span className={`text-[10px] whitespace-nowrap ${i <= activeIdx ? 'text-violet-700 font-medium' : 'text-slate-400'}`}>
              {step.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div className={`h-0.5 flex-1 mx-1 ${i < activeIdx ? 'bg-violet-600' : 'bg-slate-200'}`} />
          )}
        </div>
      ))}
    </div>
  );
}

function SosSheet({ onConfirm, onCancel }) {
  const [type, setType] = useState('SAFETY');
  const [note, setNote] = useState('');
  const TYPES = [
    { key: 'SAFETY',            label: 'Safety concern' },
    { key: 'MEDICAL',           label: 'Medical emergency' },
    { key: 'PATIENT_CONDITION', label: 'Patient condition' },
    { key: 'OTHER',             label: 'Other' },
  ];
  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40" role="dialog" aria-modal="true">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-5 shadow-2xl">
        <h3 className="text-base font-semibold text-slate-900">Send an SOS alert</h3>
        <p className="mt-1 text-sm text-slate-500">Admins are notified immediately. Only use this for a real emergency.</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          {TYPES.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setType(t.key)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition ${
                type === t.key ? 'border-red-500 bg-red-50 text-red-700' : 'border-slate-200 text-slate-600'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Optional details"
          rows={2}
          className="mt-3 w-full resize-none rounded-lg border border-slate-200 p-2 text-sm focus:border-violet-500 focus:outline-none"
        />
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onCancel} className="flex-1 rounded-lg border border-slate-200 py-2.5 text-sm font-medium text-slate-600">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onConfirm(type, note)}
            className="flex-1 rounded-lg bg-red-600 py-2.5 text-sm font-semibold text-white active:scale-[0.98]"
          >
            Send SOS
          </button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main component
// ─────────────────────────────────────────────────────────────────────────────

export default function CareAssistantLiveTracking({ bookingId: bookingIdProp, viewerRole: viewerRoleProp }) {
  const params = useParams();
  const bookingId = bookingIdProp || params?.bookingId;
  const sessionRole = useSelector((s) => s.user?.role);
  const viewerRole = viewerRoleProp || sessionRole || 'customer';

  const { loaded: mapsLoaded, error: mapsError } = useGoogleMapsLoader();

  const mapContainerRef = useRef(null);
  const mapRef           = useRef(null);
  const mapLoadedRef      = useRef(false);
  const [mapReady, setMapReady] = useState(false);
  const [showSos, setShowSos]   = useState(false);
  const announcedRef = useRef(false);

  // ── 1. Create the map once the SDK + container are both ready ────────────
  useEffect(() => {
    if (!mapsLoaded || !mapContainerRef.current || mapRef.current) return;
    mapRef.current = new window.google.maps.Map(mapContainerRef.current, {
      center: DEFAULT_CENTER,
      zoom: 14,
      mapId: MAP_ID,
      disableDefaultUI: true,
      gestureHandling: 'greedy',
      clickableIcons: false,
    });
    mapLoadedRef.current = true;
    setMapReady(true);
  }, [mapsLoaded]);

  // ── 2. Map-bound hooks ─────────────────────────────────────────────────────
  const camera     = useMapCamera(mapRef);
  const caMarker   = useCareAssistantMarker(mapRef, mapLoadedRef);
  const drvMarker  = useDriverMarker(mapRef, mapLoadedRef);
  const routes     = useRouteRenderer(mapRef);
  const voice      = useVoiceNavigation();

  // ── 3. Data + sockets ──────────────────────────────────────────────────────
  const t = useCareAssistantTracking({ bookingId, viewerRole });

  // ── Static markers: patient pickup, hospital dropoff, join point ─────────
  const staticRef = useRef({ patient: null, dropoff: null, joinPoint: null });
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    const map = mapRef.current;

    const pickupCoords = t.pickupLocation?.coordinates;
    if (pickupCoords?.length === 2 && !staticRef.current.patient) {
      staticRef.current.patient = createStaticMarker(map, pickupCoords[1], pickupCoords[0], 'pickup');
    }

    if (t.bookingType === 'full_care_ride') {
      const dropCoords = t.dropoffLocation?.coordinates;
      if (dropCoords?.length === 2 && !staticRef.current.dropoff) {
        staticRef.current.dropoff = createStaticMarker(map, dropCoords[1], dropCoords[0], 'dropoff');
      }
    }

    const jpCoords = t.caJoinPoint?.coordinates;
    if (jpCoords?.length === 2 && t.phase === 'navigate_to_jp') {
      staticRef.current.joinPoint?.map && (staticRef.current.joinPoint.map = null);
      staticRef.current.joinPoint = createStaticMarker(map, jpCoords[1], jpCoords[0], 'joinpoint');
    }
  }, [mapReady, t.pickupLocation, t.dropoffLocation, t.bookingType, t.caJoinPoint, t.phase]);

  // Join point marker must disappear once the CA boards — it's no longer
  // relevant once we switch to driver-tracking mode.
  useEffect(() => {
    if (t.phase === 'in_vehicle' && staticRef.current.joinPoint) {
      staticRef.current.joinPoint.map = null;
      staticRef.current.joinPoint = null;
    }
  }, [t.phase]);

  // ── Request the CA's own route once (origin -> JP, or origin -> patient) ─
  const caRouteRequestedRef = useRef(false);
  useEffect(() => {
    if (!mapReady || caRouteRequestedRef.current) return;
    if (t.phase !== 'navigate_to_jp' && t.phase !== 'standalone') return;

    const origin = t.currentPosition || (t.caLiveLocation
      ? { lat: t.caLiveLocation.lat, lng: t.caLiveLocation.lng }
      : null);
    const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
    if (!origin || !destCoords?.length) return;

    caRouteRequestedRef.current = true;
    const svc = new window.google.maps.DirectionsService();
    svc.route(
      {
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destCoords[1], lng: destCoords[0] },
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === 'OK') routes.setCaRoute(result);
        else caRouteRequestedRef.current = false; // allow retry on next position tick
      }
    );
  }, [mapReady, t.phase, t.currentPosition, t.caLiveLocation, t.caJoinPoint, t.pickupLocation, routes]);

  // A recalculated join point invalidates the drawn route — clear the
  // "already requested" flag so the effect above fires again.
  const lastJpKeyRef = useRef(null);
  useEffect(() => {
    const key = t.caJoinPoint?.coordinates ? t.caJoinPoint.coordinates.join(',') : null;
    if (key && key !== lastJpKeyRef.current) {
      lastJpKeyRef.current = key;
      caRouteRequestedRef.current = false;
      routes.clearCaRoute();
    }
  }, [t.caJoinPoint, routes]);

  // ── Render driver route from the server-canonical polyline once boarded ──
  const driverRouteAppliedRef = useRef(false);
  useEffect(() => {
    if (t.phase !== 'in_vehicle' || !mapReady) return;
    if (!t.expectedPolyline || driverRouteAppliedRef.current) return;
    driverRouteAppliedRef.current = true;
    routes.setRouteFromPolyline(t.expectedPolyline, 'toDropoff');
  }, [t.phase, t.expectedPolyline, mapReady, routes]);

  // ── Drive the markers + camera + route progress off live position ────────
  useEffect(() => {
    if (!mapReady) return;

    if (t.phase === 'navigate_to_jp' || t.phase === 'standalone') {
      const pos = t.isSelf ? t.currentPosition : t.caLiveLocation;
      if (pos?.lat && pos?.lng) {
        caMarker.updateMarker(pos.lat, pos.lng, pos.heading || 0, camera.mapBearingRef.current, t.caStatus);
        routes.updateCaProgress(pos.lat, pos.lng);
        if (camera.followModeRef.current) {
          camera.updateCamera(pos.lat, pos.lng, pos.heading || 0, pos.speed || 0);
        }

        // One-time proximity announcement
        const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
        if (destCoords?.length === 2 && !announcedRef.current) {
          const distKm = distanceKm(pos.lat, pos.lng, destCoords[1], destCoords[0]);
          if (distKm <= APPROACH_ANNOUNCE_KM) {
            announcedRef.current = true;
            voice.speak(
              t.phase === 'navigate_to_jp' ? 'You are approaching the join point.' : 'You are approaching the patient location.',
              { priority: voice.PRIORITY.HIGH }
            );
          }
        }
      }
    }

    if (t.phase === 'in_vehicle') {
      caMarker.destroyMarker();
      const pos = t.driverLiveLocation;
      if (pos?.lat && pos?.lng) {
        drvMarker.updateMarker(pos.lat, pos.lng, pos.heading || 0, camera.mapBearingRef.current, pos.speedKmh || pos.speed || 0);
        routes.updateProgress(pos.lat, pos.lng);
        if (camera.followModeRef.current) {
          camera.updateCamera(pos.lat, pos.lng, pos.heading || 0, pos.speedKmh || pos.speed || 0);
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapReady, t.phase, t.currentPosition, t.caLiveLocation, t.driverLiveLocation, t.caStatus]);

  // ── Derived UI bits ───────────────────────────────────────────────────────
  const steps = STATUS_STEPS[t.phase] || [];
  const activeStepKey = t.caStatus || t.rideStatus;

  const distToDestKm = useMemo(() => {
    const pos = t.isSelf ? t.currentPosition : t.caLiveLocation;
    const destCoords = t.phase === 'navigate_to_jp' ? t.caJoinPoint?.coordinates : t.pickupLocation?.coordinates;
    if (!pos?.lat || !destCoords?.length) return null;
    return distanceKm(pos.lat, pos.lng, destCoords[1], destCoords[0]);
  }, [t.isSelf, t.currentPosition, t.caLiveLocation, t.phase, t.caJoinPoint, t.pickupLocation]);

  const handleBack = useCallback(() => {
    if (typeof window !== 'undefined') window.history.back();
  }, []);

  const handleSosConfirm = useCallback((sosType, description) => {
    t.actions.sos(sosType, description);
    setShowSos(false);
  }, [t.actions]);

  const handlePrimaryAction = useCallback(() => {
    const pos = t.currentPosition;
    if (t.phase === 'navigate_to_jp') {
      if (!t.caAtJoinPoint) t.actions.reachedJoinPoint(pos?.lat, pos?.lng);
      else t.actions.boardVehicle(pos?.lat, pos?.lng);
      return;
    }
    if (t.phase === 'standalone') {
      if (t.caStatus === 'en_route_to_pickup' || !t.caStatus) t.actions.markArrived();
      else if (t.caStatus === 'at_pickup' || t.rideStatus === 'confirmed') t.actions.startTask();
      else t.actions.completeTask();
    }
  }, [t.phase, t.caAtJoinPoint, t.currentPosition, t.caStatus, t.rideStatus, t.actions]);

  const primaryLabel = useMemo(() => {
    if (t.phase === 'navigate_to_jp') return t.caAtJoinPoint ? "I've boarded the vehicle" : "I've reached the join point";
    if (t.phase === 'standalone') {
      if (t.caStatus === 'at_pickup') return 'Start task';
      if (t.caStatus === 'in_progress' || t.rideStatus === 'in_progress') return 'Mark task complete';
      return "I've arrived";
    }
    return null;
  }, [t.phase, t.caAtJoinPoint, t.caStatus, t.rideStatus]);

  // ── Render ──────────────────────────────────────────────────────────────
  if (!bookingId) {
    return <div className="flex h-screen items-center justify-center text-slate-500">Missing booking id.</div>;
  }

  if (mapsError) {
    return <div className="flex h-screen items-center justify-center px-6 text-center text-red-600">{mapsError}</div>;
  }

  return (
    <div className="relative h-screen w-full overflow-hidden bg-slate-100">
      <div ref={mapContainerRef} className="absolute inset-0" />

      {!mapReady && (
        <div className="absolute inset-0 z-30 flex items-center justify-center bg-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet-200 border-t-violet-600" />
            <span className="text-sm text-slate-500">Loading map…</span>
          </div>
        </div>
      )}

      <TopBar bookingCode={t.snapshot?.bookingCode} phase={t.phase} onBack={handleBack} />

      {t.isOffline && <Banner tone="warning">You're offline — last known position shown.</Banner>}
      {!t.isOffline && t.gpsError && <Banner tone="warning">{t.gpsError}</Banner>}
      {!t.isOffline && !t.gpsError && t.loadError && <Banner tone="danger">{t.loadError}</Banner>}
      {t.hasActiveSos && <Banner tone="danger">SOS active on this ride — admin has been notified.</Banner>}

      {mapReady && (
        <FloatingControls
          onRecenter={() => {
            const pos = t.phase === 'in_vehicle' ? t.driverLiveLocation : (t.isSelf ? t.currentPosition : t.caLiveLocation);
            if (pos?.lat) camera.recenter(pos.lat, pos.lng, pos.heading || 0);
          }}
          onNorthUp={camera.resetToNorth}
          onZoomIn={camera.zoomIn}
          onZoomOut={camera.zoomOut}
          voiceEnabled={voice.voiceEnabled}
          onToggleVoice={voice.toggleVoice}
        />
      )}

      {/* ── Bottom sheet ─────────────────────────────────────────────────── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 rounded-t-3xl bg-white px-5 pb-6 pt-4 shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-slate-200" />

        {t.phase === 'awaiting_assignment' ? (
          <p className="py-4 text-center text-sm text-slate-500">Waiting for a ride to be assigned to this booking…</p>
        ) : (
          <>
            {steps.length > 0 && <StatusTimeline steps={steps} activeKey={activeStepKey} />}

            <div className="mt-4 flex items-center justify-between">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-400">
                  {t.phase === 'in_vehicle' ? 'Driver ETA' : 'Distance remaining'}
                </p>
                <p className="text-lg font-semibold text-slate-900">
                  {t.phase === 'in_vehicle' ? formatEta(t.etaMinutes) : formatDistance(distToDestKm)}
                </p>
              </div>
              {t.phase !== 'in_vehicle' && (
                <div className="text-right">
                  <p className="text-xs uppercase tracking-wide text-slate-400">ETA</p>
                  <p className="text-lg font-semibold text-slate-900">{formatEta(t.etaMinutes)}</p>
                </div>
              )}
            </div>

            {t.driverSnapshot && t.phase !== 'standalone' && (
              <div className="mt-3 flex items-center justify-between rounded-xl bg-slate-50 px-3 py-2">
                <div>
                  <p className="text-sm font-medium text-slate-800">{t.driverSnapshot.legalName || t.driverSnapshot.name}</p>
                  <p className="text-xs text-slate-500">{t.vehicleSnapshot?.registrationNumber || 'Vehicle assigned'}</p>
                </div>
                {t.driverSnapshot.phone && (
                  <a href={`tel:${t.driverSnapshot.phone}`} className="rounded-full bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white">
                    Call
                  </a>
                )}
              </div>
            )}

            <div className="mt-4 flex gap-2">
              {t.isSelf && primaryLabel && (
                <button
                  type="button"
                  onClick={handlePrimaryAction}
                  className="flex-1 rounded-xl bg-violet-600 py-3 text-sm font-semibold text-white active:scale-[0.99] transition"
                >
                  {primaryLabel}
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowSos(true)}
                className={`rounded-xl border border-red-200 px-4 py-3 text-sm font-semibold text-red-600 active:scale-[0.99] transition ${
                  t.isSelf && primaryLabel ? '' : 'flex-1'
                }`}
              >
                SOS
              </button>
            </div>
          </>
        )}
      </div>

      {showSos && <SosSheet onConfirm={handleSosConfirm} onCancel={() => setShowSos(false)} />}
    </div>
  );
}