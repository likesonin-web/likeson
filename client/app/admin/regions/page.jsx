'use client';

import { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import dynamic from 'next/dynamic';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, PolarGrid, PolarAngleAxis,
  Radar, Legend,
} from 'recharts';
import {
  MapPin, Building2, Stethoscope, Car, TrendingUp,
  RefreshCw, Search, ChevronDown, ChevronUp, IndianRupee,
  Siren, Droplets, BadgeCheck, SlidersHorizontal, BarChart3,
  Globe2, Map,
} from 'lucide-react';

import {
  fetchRegional,
  selectRegionalLoading,
  selectRegionalError,
  selectRegionalCities,
} from '@/store/slices/adminAnalyticsSlice';

// ─── Leaflet (client-only) ──────────────────────────────────────────────────
// Dynamically import so SSR never touches window/document
const CityMap = dynamic(() => import('./CityMap'), { ssr: false });

// ─── helpers ───────────────────────────────────────────────────────────────

const fmt    = (n = 0) => Number(n).toLocaleString('en-IN');
const fmtRev = (n = 0) => n >= 100_000 ? `₹${(n / 100_000).toFixed(1)}L` : `₹${fmt(n)}`;

const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.06, duration: 0.45, ease: 'easeOut' },
  }),
};

const SORT_OPTIONS = [
  { key: 'hospitals.total', label: 'Hospitals'  },
  { key: 'doctors.total',   label: 'Doctors'    },
  { key: 'bookings.count',  label: 'Bookings'   },
  { key: 'bookings.revenue',label: 'Revenue'    },
  { key: 'transport.agents',label: 'Transport'  },
];

const dig = (obj, path) => path.split('.').reduce((o, k) => o?.[k], obj) ?? 0;

// ─── sub-components ────────────────────────────────────────────────────────

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card px-4 py-3 text-xs shadow-depth min-w-[140px]">
      <p className="font-bold text-base-content mb-2">{label}</p>
      {payload.map((p, i) => (
        <div key={i} className="flex items-center justify-between gap-4">
          <span style={{ color: p.fill || p.color }} className="font-semibold">{p.name}</span>
          <span className="font-bold text-base-content">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

function MiniBar({ value, max, color = 'var(--primary)' }) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-base-300 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <span className="text-xs font-bold text-base-content/70 w-8 text-right">{fmt(value)}</span>
    </div>
  );
}

function CityRow({ city, maxes, rank, expanded, onToggle }) {
  const h = city.hospitals ?? {};
  const d = city.doctors   ?? {};
  const b = city.bookings  ?? {};
  const t = city.transport ?? {};

  const pills = [
    h.emergency  && { label: 'Emergency', icon: Siren,      cls: 'badge-error'   },
    h.hasBloodBank && { label: 'Blood Bank', icon: Droplets, cls: 'badge-error'  },
    h.verified   && { label: `${h.verified} Verified`, icon: BadgeCheck, cls: 'badge-success' },
  ].filter(Boolean);

  return (
    <>
      <motion.tr
        layout
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        className="cursor-pointer hover:bg-primary/5 transition-colors"
        onClick={onToggle}
      >
        <td>
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-base-content/40 w-5">{rank}</span>
            <span className="p-1.5 rounded-lg bg-primary/10">
              <MapPin size={13} className="text-primary" />
            </span>
            <span className="font-semibold text-sm text-base-content">{city.city ?? 'Unknown'}</span>
          </div>
        </td>
        <td><MiniBar value={h.total ?? 0} max={maxes.hospitals} /></td>
        <td><MiniBar value={d.total ?? 0} max={maxes.doctors} color="var(--secondary)" /></td>
        <td><MiniBar value={b.count ?? 0} max={maxes.bookings} color="var(--accent)" /></td>
        <td className="text-right">
          <span className="text-xs font-bold text-success">
            {b.revenue ? fmtRev(b.revenue) : '—'}
          </span>
        </td>
        <td className="text-right">
          <span className="text-xs text-base-content/60">{t.agents ?? 0}</span>
        </td>
        <td className="text-right">
          <button className="btn btn-ghost btn-xs btn-circle">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </td>
      </motion.tr>

      <AnimatePresence>
        {expanded && (
          <motion.tr
            key={`${city.city}-expand`}
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
          >
            <td colSpan={7} className="p-0">
              <motion.div
                initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-primary/3 border-t border-b border-primary/10 px-6 py-4"
              >
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Hospitals</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-base-content/60">Managed</span><span className="font-semibold">{h.managed ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Owner-Op</span><span className="font-semibold">{h.ownerOp ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Emergency</span><span className="font-semibold text-error">{h.emergency ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Blood Bank</span><span className="font-semibold text-error">{h.hasBloodBank ?? 0}</span></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Doctors</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-base-content/60">Verified</span><span className="font-semibold text-success">{d.verified ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Online Now</span><span className="font-semibold text-info">{d.online ?? 0}</span></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Bookings</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-base-content/60">Total</span><span className="font-semibold">{fmt(b.count ?? 0)}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Revenue</span><span className="font-semibold text-success">{fmtRev(b.revenue ?? 0)}</span></div>
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-xs font-bold text-base-content/50 uppercase tracking-wider">Transport</p>
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between"><span className="text-base-content/60">Agents</span><span className="font-semibold">{t.agents ?? 0}</span></div>
                      <div className="flex justify-between"><span className="text-base-content/60">Active</span><span className="font-semibold text-success">{t.active ?? 0}</span></div>
                    </div>
                  </div>
                </div>

                {pills.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-3">
                    {pills.map((p, i) => (
                      <span key={i} className={`badge ${p.cls} badge-sm gap-1`}>
                        <p.icon size={10} />
                        {p.label}
                      </span>
                    ))}
                  </div>
                )}
              </motion.div>
            </td>
          </motion.tr>
        )}
      </AnimatePresence>
    </>
  );
}

// ─── main component ────────────────────────────────────────────────────────

export default function RegionalScope() {
  const dispatch = useDispatch();

  const loading = useSelector(selectRegionalLoading);
  const error   = useSelector(selectRegionalError);
  const cities  = useSelector(selectRegionalCities);

  const [sortKey, setSortKey]       = useState('hospitals.total');
  const [search, setSearch]         = useState('');
  const [expandedCity, setExpanded] = useState(null);
  const [chartView, setChartView]   = useState('bar'); // 'bar' | 'radar' | 'map'

  useEffect(() => { dispatch(fetchRegional()); }, [dispatch]);

  const processed = useMemo(() => {
    if (!cities) return [];
    let list = cities.filter(c =>
      c.city && c.city.toLowerCase().includes(search.toLowerCase())
    );
    list = [...list].sort((a, b) => dig(b, sortKey) - dig(a, sortKey));
    return list;
  }, [cities, sortKey, search]);

  const top10 = processed.slice(0, 10);

  const barData = top10.map(c => ({
    city:       c.city,
    Hospitals:  c.hospitals?.total  ?? 0,
    Doctors:    c.doctors?.total    ?? 0,
    Bookings:   c.bookings?.count   ?? 0,
    Transport:  c.transport?.agents ?? 0,
  }));

  const radarData = top10.map(c => ({
    subject: c.city,
    A: c.hospitals?.total  ?? 0,
    B: c.doctors?.total    ?? 0,
    C: c.bookings?.count   ?? 0,
  }));

  const maxes = useMemo(() => ({
    hospitals: Math.max(...processed.map(c => c.hospitals?.total ?? 0), 1),
    doctors:   Math.max(...processed.map(c => c.doctors?.total   ?? 0), 1),
    bookings:  Math.max(...processed.map(c => c.bookings?.count  ?? 0), 1),
  }), [processed]);

  const totals = useMemo(() => ({
    cities:    processed.length,
    hospitals: processed.reduce((s, c) => s + (c.hospitals?.total ?? 0), 0),
    doctors:   processed.reduce((s, c) => s + (c.doctors?.total   ?? 0), 0),
    bookings:  processed.reduce((s, c) => s + (c.bookings?.count  ?? 0), 0),
    revenue:   processed.reduce((s, c) => s + (c.bookings?.revenue ?? 0), 0),
    transport: processed.reduce((s, c) => s + (c.transport?.agents ?? 0), 0),
  }), [processed]);

  const toggleCity = (city) => setExpanded(p => p === city ? null : city);

  return (
    <div className="container-custom py-6 space-y-6 max-w-7xl">

      {/* PAGE HEADER */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 rounded-xl bg-primary/10">
              <Globe2 size={18} className="text-primary" />
            </span>
            <h1 className="section-heading !mb-0 !text-2xl md:!text-3xl">Regional Scope</h1>
          </div>
          <p className="section-subheading !mb-0 text-sm">
            City-level distribution of hospitals, doctors, bookings, and transport
          </p>
        </div>

        <button
          onClick={() => dispatch(fetchRegional())}
          className="btn btn-ghost btn-sm gap-2 self-start sm:self-auto"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </motion.div>

      {/* ERROR */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="alert alert-error"
          >
            <span className="text-sm">{error}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* PLATFORM TOTALS */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          { icon: Globe2,       label: 'Cities',     value: fmt(totals.cities),    cls: 'text-primary'   },
          { icon: Building2,    label: 'Hospitals',  value: fmt(totals.hospitals), cls: 'text-secondary' },
          { icon: Stethoscope,  label: 'Doctors',    value: fmt(totals.doctors),   cls: 'text-info'      },
          { icon: TrendingUp,   label: 'Bookings',   value: fmt(totals.bookings),  cls: 'text-accent'    },
          { icon: IndianRupee,  label: 'Revenue',    value: fmtRev(totals.revenue),cls: 'text-success'   },
          { icon: Car,          label: 'Transport',  value: fmt(totals.transport), cls: 'text-warning'   },
        ].map((item, i) => (
          <motion.div
            key={item.label}
            variants={fadeUp} initial="hidden" animate="visible" custom={i}
            className="stat-card !p-4"
          >
            <item.icon size={16} className={`${item.cls} mb-2`} />
            <p className="stat-card-label text-[10px]">{item.label}</p>
            {loading
              ? <div className="skeleton h-6 w-16 mt-1 rounded" />
              : <p className={`text-lg font-extrabold font-montserrat ${item.cls}`}>{item.value}</p>
            }
          </motion.div>
        ))}
      </div>

      {/* CHART / MAP SECTION */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={3}
        className="card p-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h3 className="font-montserrat font-extrabold text-base text-base-content">
              {chartView === 'map' ? 'City Map' : 'Top 10 Cities — Distribution'}
            </h3>
            <p className="text-xs text-base-content/50 mt-0.5">
              {chartView === 'map'
                ? 'Interactive map — click a pin for city stats'
                : `Sorted by ${SORT_OPTIONS.find(s => s.key === sortKey)?.label}`}
            </p>
          </div>

          {/* view toggle: bar | radar | map */}
          <div className="flex items-center gap-2">
            <div className="flex rounded-lg border border-base-300 overflow-hidden bg-base-200">
              {[
                { key: 'bar',   Icon: BarChart3        },
                { key: 'radar', Icon: SlidersHorizontal },
                { key: 'map',   Icon: Map              },
              ].map(({ key, Icon }) => (
                <button
                  key={key}
                  onClick={() => setChartView(key)}
                  className={`px-3 py-1.5 transition-colors duration-200 ${
                    chartView === key
                      ? 'bg-primary text-primary-content'
                      : 'text-base-content/60 hover:text-base-content hover:bg-base-300'
                  }`}
                >
                  <Icon size={15} />
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="skeleton h-56 rounded-xl" />
        ) : top10.length === 0 ? (
          <div className="flex items-center justify-center h-48 text-base-content/30 text-sm">
            No regional data available
          </div>
        ) : chartView === 'bar' ? (
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barData} margin={{ top: 4, right: 4, left: -16, bottom: 0 }} barSize={14} barGap={2}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
              <XAxis dataKey="city" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.5 }} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTip />} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} />
              <Bar dataKey="Hospitals" fill="var(--primary)"   radius={[3, 3, 0, 0]} />
              <Bar dataKey="Doctors"   fill="var(--secondary)" radius={[3, 3, 0, 0]} />
              <Bar dataKey="Bookings"  fill="var(--accent)"    radius={[3, 3, 0, 0]} />
              <Bar dataKey="Transport" fill="var(--success)"   radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : chartView === 'radar' ? (
          <ResponsiveContainer width="100%" height={260}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="var(--base-300)" />
              <PolarAngleAxis dataKey="subject" tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }} />
              <Radar name="Hospitals" dataKey="A" stroke="var(--primary)"   fill="var(--primary)"   fillOpacity={0.20} />
              <Radar name="Doctors"   dataKey="B" stroke="var(--secondary)" fill="var(--secondary)" fillOpacity={0.20} />
              <Radar name="Bookings"  dataKey="C" stroke="var(--accent)"    fill="var(--accent)"    fillOpacity={0.20} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Tooltip content={<ChartTip />} />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          /* MAP VIEW — rendered by separate CityMap component (client-only) */
          <CityMap cities={processed} height={320} />
        )}
      </motion.div>

      {/* TABLE SECTION */}
      <motion.div
        variants={fadeUp} initial="hidden" animate="visible" custom={5}
        className="card overflow-hidden"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-base-300">
          <h3 className="font-montserrat font-extrabold text-base text-base-content">All Cities</h3>

          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                type="text"
                placeholder="Search city…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input-field pl-9 !py-1.5 text-xs w-44"
              />
            </div>

            <div className="flex items-center gap-1 flex-wrap">
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.key}
                  onClick={() => setSortKey(opt.key)}
                  className={`btn btn-xs ${sortKey === opt.key ? 'btn-primary' : 'btn-ghost'}`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-6 space-y-3">
              {[...Array(6)].map((_, i) => <div key={i} className="skeleton h-12 rounded" />)}
            </div>
          ) : processed.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-base-content/30">
              <MapPin size={36} className="mb-2 opacity-40" />
              <p className="text-sm">No cities found</p>
            </div>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th>City</th>
                  <th>Hospitals</th>
                  <th>Doctors</th>
                  <th>Bookings</th>
                  <th className="text-right">Revenue</th>
                  <th className="text-right">Transport</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {processed.map((city, i) => (
                  <CityRow
                    key={city.city}
                    city={city}
                    maxes={maxes}
                    rank={i + 1}
                    expanded={expandedCity === city.city}
                    onToggle={() => toggleCity(city.city)}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>

        {!loading && processed.length > 0 && (
          <div className="px-5 py-3 border-t border-base-300">
            <p className="text-xs text-base-content/40">
              Showing {processed.length} cit{processed.length === 1 ? 'y' : 'ies'} &bull; Click row to expand details
            </p>
          </div>
        )}
      </motion.div>
    </div>
  );
}