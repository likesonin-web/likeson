'use client';

/**
 * CityMap.jsx — Leaflet map rendered client-side only.
 * Imported via next/dynamic (ssr: false) from RegionalScope.
 *
 * Props:
 *   cities  — array from Redux (selectRegionalCities shape)
 *   height  — px height of map container (default 320)
 */

import { useEffect } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';

// ─── helpers ───────────────────────────────────────────────────────────────

const fmt    = (n = 0) => Number(n).toLocaleString('en-IN');
const fmtRev = (n = 0) => n >= 100_000 ? `₹${(n / 100_000).toFixed(1)}L` : `₹${fmt(n)}`;

/**
 * Naïve geocoder — returns lat/lng for Indian cities by name.
 * For production: replace with a geocoding API call or store coords in DB.
 */
const CITY_COORDS = {
  'Mumbai':      [19.0760,  72.8777],
  'Delhi':       [28.6139,  77.2090],
  'Bangalore':   [12.9716,  77.5946],
  'Bengaluru':   [12.9716,  77.5946],
  'Hyderabad':   [17.3850,  78.4867],
  'Ahmedabad':   [23.0225,  72.5714],
  'Chennai':     [13.0827,  80.2707],
  'Kolkata':     [22.5726,  88.3639],
  'Surat':       [21.1702,  72.8311],
  'Pune':        [18.5204,  73.8567],
  'Jaipur':      [26.9124,  75.7873],
  'Lucknow':     [26.8467,  80.9462],
  'Kanpur':      [26.4499,  80.3319],
  'Nagpur':      [21.1458,  79.0882],
  'Indore':      [22.7196,  75.8577],
  'Thane':       [19.2183,  72.9781],
  'Bhopal':      [23.2599,  77.4126],
  'Visakhapatnam':[17.6868, 83.2185],
  'Patna':       [25.5941,  85.1376],
  'Vadodara':    [22.3072,  73.1812],
  'Ghaziabad':   [28.6692,  77.4538],
  'Ludhiana':    [30.9010,  75.8573],
  'Agra':        [27.1767,  78.0081],
  'Nashik':      [19.9975,  73.7898],
  'Faridabad':   [28.4089,  77.3178],
  'Meerut':      [28.9845,  77.7064],
  'Rajkot':      [22.3039,  70.8022],
  'Varanasi':    [25.3176,  82.9739],
  'Srinagar':    [34.0837,  74.7973],
  'Aurangabad':  [19.8762,  75.3433],
  'Dhanbad':     [23.7957,  86.4304],
  'Amritsar':    [31.6340,  74.8723],
  'Navi Mumbai': [19.0330,  73.0297],
  'Coimbatore':  [11.0168,  76.9558],
  'Madurai':     [ 9.9252,  78.1198],
  'Kochi':       [ 9.9312,  76.2673],
  'Chandigarh':  [30.7333,  76.7794],
  'Guwahati':    [26.1445,  91.7362],
  'Bhubaneswar': [20.2961,  85.8245],
  'Dehradun':    [30.3165,  78.0322],
  'Vijayawada':  [16.5062,  80.6480],
  'Jodhpur':     [26.2389,  73.0243],
  'Raipur':      [21.2514,  81.6296],
  'Kota':        [25.2138,  75.8648],
  'Gwalior':     [26.2183,  78.1828],
  'Tiruchirappalli': [10.7905, 78.7047],
  'Thiruvananthapuram': [8.5241, 76.9366],
  'Noida':       [28.5355,  77.3910],
};

const getCoords = (cityName) => {
  if (!cityName) return null;
  // exact match
  if (CITY_COORDS[cityName]) return CITY_COORDS[cityName];
  // case-insensitive
  const key = Object.keys(CITY_COORDS).find(
    k => k.toLowerCase() === cityName.toLowerCase()
  );
  return key ? CITY_COORDS[key] : null;
};

/** Scale radius 4–24 based on value within max */
const scaleRadius = (value, max) => {
  if (!max) return 6;
  return 4 + Math.round((value / max) * 20);
};

// ─── auto-fit bounds ────────────────────────────────────────────────────────

function FitBounds({ points }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) {
      map.setView(points[0], 8);
      return;
    }
    const L = window.L || require('leaflet');
    map.fitBounds(L.latLngBounds(points), { padding: [40, 40] });
  }, [map, points]);
  return null;
}

// ─── main map component ─────────────────────────────────────────────────────

export default function CityMap({ cities = [], height = 320 }) {
  // only cities with known coords
  const pinned = cities
    .map(c => ({ ...c, coords: getCoords(c.city) }))
    .filter(c => c.coords);

  const maxHospitals = Math.max(...pinned.map(c => c.hospitals?.total ?? 0), 1);

  const points = pinned.map(c => c.coords);

  return (
    <div style={{ height, borderRadius: '0.75rem', overflow: 'hidden', position: 'relative', zIndex: 0 }}>
      {pinned.length === 0 ? (
        <div className="flex items-center justify-center h-full text-base-content/30 text-sm bg-base-200 rounded-xl">
          No city coordinates available — add coords to CITY_COORDS map
        </div>
      ) : (
        <MapContainer
          center={[20.5937, 78.9629]} // India center fallback
          zoom={5}
          scrollWheelZoom={false}
          style={{ height: '100%', width: '100%' }}
          attributionControl={false}
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="© OpenStreetMap"
          />

          <FitBounds points={points} />

          {pinned.map((city) => {
            const h = city.hospitals ?? {};
            const d = city.doctors   ?? {};
            const b = city.bookings  ?? {};
            const t = city.transport ?? {};
            const radius = scaleRadius(h.total ?? 0, maxHospitals);

            return (
              <CircleMarker
                key={city.city}
                center={city.coords}
                radius={radius}
                pathOptions={{
                  fillColor: 'oklch(55% 0.22 260)',
                  color:     'oklch(40% 0.22 260)',
                  weight:    1.5,
                  opacity:   0.9,
                  fillOpacity: 0.55,
                }}
              >
                <Popup>
                  <div style={{ minWidth: 160, fontFamily: 'inherit', fontSize: 12 }}>
                    <p style={{ fontWeight: 700, marginBottom: 6, fontSize: 13 }}>{city.city}</p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <tbody>
                        {[
                          ['Hospitals',  h.total   ?? 0],
                          ['Doctors',    d.total   ?? 0],
                          ['Bookings',   fmt(b.count ?? 0)],
                          ['Revenue',    fmtRev(b.revenue ?? 0)],
                          ['Transport',  t.agents  ?? 0],
                        ].map(([label, val]) => (
                          <tr key={label}>
                            <td style={{ color: '#888', paddingRight: 8, paddingBottom: 2 }}>{label}</td>
                            <td style={{ fontWeight: 600, textAlign: 'right' }}>{val}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}