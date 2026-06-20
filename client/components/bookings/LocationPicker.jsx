"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, Autocomplete, Marker } from "@react-google-maps/api";
import {
  MapPin,
  Building2,
  Search,
  LocateFixed,
  Loader2,
} from "lucide-react";
import { Field } from "./atoms";
import { PP, VIJAYAWADA, MAP_CONTAINER_STYLE } from "@/lib/constants";

export function LocationPicker({
  label,
  note,
  value,
  onChange,
  error,
  required,
  readOnly,
  readOnlyNote,
  isLoaded,
}) {
  const [expanded, setExpanded] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);
  const [markerPos, setMarkerPos] = useState(
    value?.coordinates
      ? { lat: value.coordinates[1], lng: value.coordinates[0] }
      : VIJAYAWADA,
  );
  const autocompleteRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (value?.coordinates)
      setMarkerPos({ lat: value.coordinates[1], lng: value.coordinates[0] });
  }, [value?.coordinates?.[0], value?.coordinates?.[1]]);

  const reverseGeocode = useCallback(
    (latLng) => {
      if (!window.google?.maps) return;
      const geocoder = new window.google.maps.Geocoder();
      geocoder.geocode({ location: latLng }, (results, status) => {
        if (status === "OK" && results[0]) {
          const r = results[0];
          const comps = r.address_components || [];
          onChange({
            address: r.formatted_address,
            city:
              comps.find((c) => c.types.includes("locality"))?.long_name ||
              "Vijayawada",
            pincode:
              comps.find((c) => c.types.includes("postal_code"))?.long_name ||
              "",
            coordinates: [latLng.lng(), latLng.lat()],
          });
        }
      });
    },
    [onChange],
  );

  const handleMapClick = useCallback(
    (e) => {
      if (readOnly) return;
      const ll = e.latLng;
      setMarkerPos({ lat: ll.lat(), lng: ll.lng() });
      reverseGeocode(ll);
    },
    [reverseGeocode, readOnly],
  );

  const handleMarkerDragEnd = useCallback(
    (e) => {
      if (readOnly) return;
      const ll = e.latLng;
      setMarkerPos({ lat: ll.lat(), lng: ll.lng() });
      reverseGeocode(ll);
    },
    [reverseGeocode, readOnly],
  );

  const handlePlaceChanged = useCallback(() => {
    if (!autocompleteRef.current || readOnly) return;
    const place = autocompleteRef.current.getPlace();
    if (!place?.geometry) return;
    const loc = place.geometry.location;
    const comps = place.address_components || [];
    setMarkerPos({ lat: loc.lat(), lng: loc.lng() });
    onChange({
      address: place.formatted_address,
      city:
        comps.find((c) => c.types.includes("locality"))?.long_name ||
        "Vijayawada",
      pincode:
        comps.find((c) => c.types.includes("postal_code"))?.long_name || "",
      coordinates: [loc.lng(), loc.lat()],
    });
  }, [onChange, readOnly]);

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation || readOnly) return;
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGeoLoading(false);
        const lat = pos.coords.latitude,
          lng = pos.coords.longitude;
        if (!window.google?.maps) return;
        const ll = new window.google.maps.LatLng(lat, lng);
        setMarkerPos({ lat, lng });
        reverseGeocode(ll);
      },
      () => setGeoLoading(false),
      { enableHighAccuracy: true, timeout: 8000 },
    );
  }, [reverseGeocode, readOnly]);

  if (readOnly && value?.address) {
    return (
      <Field label={label} required={required} note={note} error={error}>
        <div className="flex items-start gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
          <Building2 size={13} className="text-primary flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-primary truncate" style={PP}>
              {value.address}
            </p>
            <p className="text-[10px] text-base-content/45 mt-0.5" style={PP}>
              {readOnlyNote || "Auto-set from hospital location"}
            </p>
          </div>
          <span
            className="text-[9px] font-black uppercase tracking-widest bg-primary/10 text-primary px-1.5 py-0.5 rounded-md flex-shrink-0"
            style={PP}
          >
            Auto
          </span>
        </div>
      </Field>
    );
  }

  return (
    <Field label={label} required={required} note={note} error={error}>
      <div
        className={`border rounded-xl transition-all ${expanded ? "border-primary" : "border-base-300"}`}
      >
        <div className="flex items-center gap-2 px-3 py-2.5">
          <button
            type="button"
            onClick={() => !readOnly && setExpanded((e) => !e)}
            className="flex-1 flex items-center gap-2 text-left hover:bg-base-200/60 rounded-lg transition-colors min-w-0"
          >
            <MapPin size={14} className="text-primary flex-shrink-0" />
            <span className="flex-1 text-xs font-medium truncate" style={PP}>
              {value?.address ? (
                <span>{value.address}</span>
              ) : (
                <span className="opacity-30">Tap to pick on map…</span>
              )}
            </span>
            {!readOnly && (
              <span
                className="text-[9px] font-black uppercase tracking-widest opacity-40 flex-shrink-0"
                style={PP}
              >
                {expanded ? "▲" : "▼"}
              </span>
            )}
          </button>
          {!readOnly && (
            <button
              type="button"
              onClick={handleUseMyLocation}
              disabled={geoLoading}
              title="Use my current location"
              className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-primary/10 text-primary"
            >
              {geoLoading ? (
                <Loader2 size={13} className="animate-spin" />
              ) : (
                <LocateFixed size={13} />
              )}
            </button>
          )}
        </div>
        {expanded && !readOnly && (
          <div className="border-t border-base-300">
            {!isLoaded ? (
              <div className="h-44 flex items-center justify-center bg-base-200/40">
                <Loader2 size={20} className="animate-spin opacity-40" />
              </div>
            ) : (
              <>
                <div
                  className="p-2 bg-base-200/60"
                  style={{ position: "relative", zIndex: 10 }}
                >
                  <Autocomplete
                    onLoad={(ac) => {
                      autocompleteRef.current = ac;
                    }}
                    onPlaceChanged={handlePlaceChanged}
                    options={{
                      componentRestrictions: { country: "in" },
                      fields: [
                        "formatted_address",
                        "geometry",
                        "address_components",
                      ],
                    }}
                  >
                    <div className="relative">
                      <Search
                        size={12}
                        className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40"
                      />
                      <input
                        ref={inputRef}
                        type="text"
                        placeholder="Search address, landmark…"
                        defaultValue={value?.address || ""}
                        style={PP}
                        className="w-full pl-8 pr-3 py-2 text-xs bg-base-100 border border-base-300 rounded-lg outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                      />
                    </div>
                  </Autocomplete>
                </div>
                <GoogleMap
                  mapContainerStyle={MAP_CONTAINER_STYLE}
                  center={markerPos}
                  zoom={14}
                  onClick={handleMapClick}
                  options={{
                    disableDefaultUI: true,
                    zoomControl: true,
                    styles: [
                      {
                        featureType: "all",
                        elementType: "geometry",
                        stylers: [{ color: "#f8f9fb" }],
                      },
                      {
                        featureType: "road",
                        elementType: "geometry",
                        stylers: [{ color: "#ffffff" }],
                      },
                      {
                        featureType: "water",
                        elementType: "geometry",
                        stylers: [{ color: "#d4e5f7" }],
                      },
                      { featureType: "poi", stylers: [{ visibility: "off" }] },
                    ],
                  }}
                >
                  <Marker
                    position={markerPos}
                    draggable
                    onDragEnd={handleMarkerDragEnd}
                    icon={
                      isLoaded && window.google?.maps
                        ? {
                            path: window.google.maps.SymbolPath.CIRCLE,
                            scale: 9,
                            fillColor: "#4f46e5",
                            fillOpacity: 1,
                            strokeColor: "#fff",
                            strokeWeight: 3,
                          }
                        : undefined
                    }
                  />
                </GoogleMap>
              </>
            )}
            {value?.address && (
              <div className="flex items-start gap-2 px-3 py-2 bg-base-200/60 border-t border-base-300">
                <MapPin
                  size={10}
                  className="mt-0.5 flex-shrink-0 text-primary"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] font-bold truncate" style={PP}>
                    {value.address}
                  </p>
                  <p className="text-[9px] opacity-40" style={PP}>
                    {value.city}
                    {value.pincode ? ` — ${value.pincode}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onChange(null);
                    setExpanded(false);
                  }}
                  className="text-[10px] text-error font-bold flex-shrink-0 hover:underline"
                  style={PP}
                >
                  Clear
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </Field>
  );
}
