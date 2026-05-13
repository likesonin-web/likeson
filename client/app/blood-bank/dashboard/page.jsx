'use client';

import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
  Droplets, TrendingUp, TrendingDown, Package, AlertTriangle,
  CheckCircle2, XCircle, Clock, Siren, Truck, FlaskConical,
  Star, BadgeCheck, Building2, Hash, MapPin, Phone, Activity,
  ArrowUpRight, ArrowDownRight, Layers, Zap, Heart, Shield,
} from 'lucide-react';

import { fetchMyBank, fetchMyInventory, fetchMyStats } from '@/store/slices/bloodbankSlice';

// ── constants ──────────────────────────────────────────────────────────────────
const BLOOD_GROUPS = ['A+','A-','B+','B-','AB+','AB-','O+','O-'];

const stagger = {
  container: { hidden: {}, show: { transition: { staggerChildren: 0.07 } } },
  item:       { hidden: { opacity: 0, y: 18 }, show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 260, damping: 22 } } },
};

// ── helpers ────────────────────────────────────────────────────────────────────
const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0);
const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

function BloodGroupMeter({ group, available = 0, reserved = 0, total = 0 }) {
  const fillPct  = clamp(pct(available, total > 0 ? total : 1));
  const resPct   = clamp(pct(reserved, total > 0 ? total : 1));
  const isCrit   = fillPct < 15;
  const isLow    = fillPct < 35 && !isCrit;
  const color    = isCrit ? 'var(--error)' : isLow ? 'var(--warning)' : 'var(--primary)';

  return (
    <motion.div
      variants={stagger.item}
      whileHover={{ scale: 1.03 }}
      className={`relative overflow-hidden rounded-xl border p-3 cursor-default transition-all duration-200
        ${isCrit ? 'bg-error/5 border-error/25' : isLow ? 'bg-warning/5 border-warning/25' : 'bg-base-100 border-base-300 hover:border-primary/30'}`}
    >
      {/* bg fill bar */}
      <div
        className="absolute inset-0 opacity-[0.07] transition-all duration-700"
        style={{ background: `linear-gradient(90deg, ${color} ${fillPct}%, transparent ${fillPct}%)` }}
      />
      <div className="relative z-10">
        <div className="flex items-center justify-between mb-2">
          <span className="font-montserrat font-black text-xl" style={{ color }}>{group}</span>
          {isCrit && <Siren size={13} className="text-error animate-pulse" />}
          {isLow  && <AlertTriangle size={13} className="text-warning" />}
        </div>
        <p className="text-2xl font-montserrat font-black text-base-content leading-none">{available}</p>
        <p className="text-[10px] text-base-content/40 mt-0.5 font-semibold uppercase tracking-wider">units ready</p>
        {reserved > 0 && (
          <p className="text-[10px] text-warning/70 mt-1">{reserved} reserved</p>
        )}
        {/* mini bar */}
        <div className="mt-2 h-1 bg-base-300 rounded-full overflow-hidden">
          <div className="h-full rounded-full transition-all duration-700" style={{ width: `${fillPct}%`, background: color }} />
        </div>
      </div>
    </motion.div>
  );
}

function StatCard({ label, value, sub, icon: Icon, trend, trendVal, color = 'primary', delay = 0 }) {
  const up = trend === 'up';
  const TrendIcon = up ? ArrowUpRight : ArrowDownRight;
  return (
    <motion.div
      variants={stagger.item}
      className="relative overflow-hidden card p-5 group hover:shadow-depth transition-all duration-300"
    >
      <div className={`absolute -top-4 -right-4 w-20 h-20 rounded-full opacity-[0.06] bg-${color}`} />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-base-content/50 uppercase tracking-widest mb-1">{label}</p>
          <p className="font-montserrat font-black text-3xl text-base-content leading-none">{value ?? '—'}</p>
          {sub && <p className="text-xs text-base-content/40 mt-1">{sub}</p>}
          {trendVal != null && (
            <div className={`flex items-center gap-1 mt-2 text-xs font-semibold ${up ? 'text-success' : 'text-error'}`}>
              <TrendIcon size={12} />
              {trendVal}
            </div>
          )}
        </div>
        <div className={`w-10 h-10 rounded-xl bg-${color}/10 flex items-center justify-center text-${color} flex-shrink-0 group-hover:scale-110 transition-transform`}>
          <Icon size={18} />
        </div>
      </div>
    </motion.div>
  );
}

function ServiceBadge({ label, active, icon: Icon, note }) {
  return (
    <div className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-all
      ${active ? 'bg-success/8 border-success/25 text-success' : 'bg-base-200 border-base-300 text-base-content/35'}`}>
      <Icon size={13} className="flex-shrink-0" />
      <div>
        <p className="font-semibold">{label}</p>
        {note && <p className="text-[10px] opacity-60">{note}</p>}
      </div>
    </div>
  );
}

function AlertBanner({ type, message }) {
  const map = {
    error:   { cls: 'bg-error/10 border-error/30 text-error',     icon: XCircle       },
    warning: { cls: 'bg-warning/10 border-warning/30 text-warning', icon: AlertTriangle },
    info:    { cls: 'bg-info/10 border-info/30 text-info',          icon: Activity      },
    success: { cls: 'bg-success/10 border-success/30 text-success', icon: CheckCircle2  },
  };
  const { cls, icon: Icon } = map[type] || map.info;
  return (
    <div className={`flex items-center gap-3 px-4 py-2.5 rounded-lg border text-xs font-semibold ${cls}`}>
      <Icon size={14} className="flex-shrink-0" />
      {message}
    </div>
  );
}

// ── MAIN ───────────────────────────────────────────────────────────────────────
export default function Overview() {
  const dispatch = useDispatch();
  const { myBank, myInventory = [], myStats, loading } = useSelector(s => s.bloodBank);

  useEffect(() => {
    dispatch(fetchMyBank());
    dispatch(fetchMyInventory());
    dispatch(fetchMyStats());
  }, [dispatch]);

  // ── derived inventory data ─────────────────────────────────────────────────
  const inventoryByGroup = useMemo(() => {
    const map = {};
    BLOOD_GROUPS.forEach(g => { map[g] = { available: 0, reserved: 0, total: 0 }; });
    myInventory.forEach(inv => {
      const g = inv.bloodGroup;
      if (!map[g]) return;
      map[g].available += inv.availableUnits || 0;
      map[g].reserved  += inv.reservedUnits  || 0;
      map[g].total     += (inv.availableUnits || 0) + (inv.reservedUnits || 0) + (inv.issuedUnits || 0);
    });
    return map;
  }, [myInventory]);

  const totalAvailable = myInventory.reduce((a, i) => a + (i.availableUnits || 0), 0);
  const totalReserved  = myInventory.reduce((a, i) => a + (i.reservedUnits  || 0), 0);
  const totalExpired   = myInventory.reduce((a, i) => a + (i.expiredUnits   || 0), 0);
  const lowStockCount  = myInventory.filter(i => i.isLowStock).length;
  const criticalCount  = myInventory.filter(i => i.isCriticalStock).length;
  const expiringSoon   = myInventory.reduce((a, i) => a + (i.expiringIn3Days || 0), 0);

  const stats = myStats?.stats || myBank?.stats || {};

  // ── alerts ─────────────────────────────────────────────────────────────────
  const alerts = [];
  if (criticalCount > 0) alerts.push({ type: 'error',   message: `${criticalCount} blood group(s) at CRITICAL stock level — immediate restocking required` });
  if (lowStockCount > 0) alerts.push({ type: 'warning', message: `${lowStockCount} blood group(s) running low — consider donor drives` });
  if (expiringSoon  > 0) alerts.push({ type: 'warning', message: `${expiringSoon} unit(s) expiring within 3 days — prioritise issuance` });
  if (myBank?.status === 'pending') alerts.push({ type: 'info', message: 'Profile pending admin verification — complete all documents to activate' });
  if (myBank?.status === 'suspended') alerts.push({ type: 'error', message: `Account suspended${myBank.suspensionReason ? ': ' + myBank.suspensionReason : ''}` });

  if (loading && !myBank) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-base-200">
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-lg text-primary" />
          <p className="text-sm text-base-content/40 font-medium">Loading dashboard…</p>
        </div>
      </div>
    );
  }

  return (
    <div data-theme="lab" className="min-h-screen bg-base-200">

      {/* ── Hero strip ───────────────────────────────────────────────────────── */}
      <div className="relative overflow-hidden bg-base-100 border-b border-base-300">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-0 right-0 w-96 h-full opacity-[0.04]"
            style={{ background: 'radial-gradient(ellipse at right top, var(--primary) 0%, transparent 70%)' }} />
          <div className="absolute -bottom-8 left-1/3 w-64 h-64 rounded-full blur-3xl opacity-[0.05]"
            style={{ background: 'var(--secondary)' }} />
          {/* decorative grid */}
          <svg className="absolute inset-0 w-full h-full opacity-[0.025]" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="32" height="32" patternUnits="userSpaceOnUse">
                <path d="M 32 0 L 0 0 0 32" fill="none" stroke="currentColor" strokeWidth="0.5"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        <div className="  py-7 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center gap-5 justify-between">
            <div className="flex px-4  items-center gap-4">
              {/* logo */}
              <div className="relative">
                <div className="w-14 h-14 rounded-2xl border-2 border-primary/20 overflow-hidden bg-primary/10 flex items-center justify-center shadow-primary">
                  {myBank?.logoUrl
                    ? <img src={myBank.logoUrl} alt="logo" className="w-full h-full object-cover" />
                    : <Droplets size={26} className="text-primary" />
                  }
                </div>
                <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-base-100
                  ${myBank?.status === 'active' ? 'bg-success' : myBank?.status === 'suspended' ? 'bg-error' : 'bg-warning'}`} />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h1 className="font-montserrat font-black text-2xl text-base-content">{myBank?.name || 'Blood Bank'}</h1>
                  {myBank?.isVerified && <BadgeCheck size={18} className="text-primary" />}
                </div>
                <div className="flex items-center gap-3 mt-0.5 text-xs text-base-content/45 flex-wrap">
                  <span className="flex items-center gap-1"><Hash size={10} />{myBank?.bankCode || '—'}</span>
                  <span className="flex items-center gap-1"><MapPin size={10} />{myBank?.address?.city}, {myBank?.address?.state}</span>
                  <span className="flex items-center gap-1"><Layers size={10} />{myBank?.bankType?.replace('_',' ')}</span>
                  {myBank?.isEmergency24x7 && <span className="flex items-center gap-1 text-error font-semibold"><Siren size={10} />24×7 ER</span>}
                </div>
              </div>
            </div>

            {/* quick service pills */}
            <div className="flex flex-wrap gap-2">
              {[
                { label:'Donations',  active: myBank?.acceptsDonations,   icon: Heart  },
                { label:'Delivery',   active: myBank?.offersDelivery,      icon: Truck  },
                { label:'Cross-Match',active: myBank?.offersCrossMatch,    icon: Shield },
                { label:'Apheresis',  active: myBank?.hasApheresisFacility,icon: FlaskConical },
              ].map(s => (
                <div key={s.label} className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all
                  ${s.active ? 'bg-success/10 border-success/30 text-success' : 'bg-base-200 border-base-300 text-base-content/30 line-through'}`}>
                  <s.icon size={11} />{s.label}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="  py-6 max-w-7xl space-y-6">

        {/* ── Alerts ── */}
        {alerts.length > 0 && (
          <motion.div initial={{ opacity:0, y:-8 }} animate={{ opacity:1, y:0 }} className="flex flex-col gap-2">
            {alerts.map((a,i) => <AlertBanner key={i} {...a} />)}
          </motion.div>
        )}

        {/* ── KPI row ── */}
        <motion.div variants={stagger.container} initial="hidden" animate="show"
          className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-6 gap-3">
          <StatCard label="Total Available" value={totalAvailable} sub="units in stock" icon={Package}    color="primary" />
          <StatCard label="Reserved"        value={totalReserved}  sub="pending issuance" icon={Clock}   color="warning" />
          <StatCard label="Collected"       value={stats.totalUnitsCollected ?? 0} sub="all time" icon={Droplets}  color="info" />
          <StatCard label="Issued"          value={stats.totalUnitsIssued ?? 0}    sub="all time" icon={TrendingUp} color="success" />
          <StatCard label="Donations"       value={stats.totalDonations ?? 0}      sub="all time" icon={Heart}      color="accent" />
          <StatCard label="Fulfillment"     value={`${pct(stats.totalRequestsFulfilled ?? 0, (stats.totalRequestsFulfilled ?? 0) + (stats.totalRequestsFailed ?? 0))}%`} sub="request success rate" icon={Activity} color="secondary" />
        </motion.div>

        {/* ── Blood Inventory Grid ── */}
        <div className="card overflow-hidden">
          <div className="px-5 py-4 border-b border-base-300 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Droplets size={16} className="text-primary" />
              </div>
              <div>
                <h2 className="font-montserrat font-bold text-base">Blood Stock Overview</h2>
                <p className="text-xs text-base-content/40">{myInventory.length} inventory slots tracked</p>
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-primary inline-block"/>Good</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-warning inline-block"/>Low</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-error inline-block"/>Critical</span>
            </div>
          </div>
          <div className="p-5">
            <motion.div variants={stagger.container} initial="hidden" animate="show"
              className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
              {BLOOD_GROUPS.map(g => (
                <BloodGroupMeter key={g} group={g} {...inventoryByGroup[g]} />
              ))}
            </motion.div>
            {/* totals bar */}
            <div className="mt-4 pt-4 border-t border-base-300 grid grid-cols-2 md:grid-cols-5 gap-3">
              {[
                { label:'Available',  val: totalAvailable, color:'text-success'  },
                { label:'Reserved',   val: totalReserved,  color:'text-warning'  },
                { label:'Expired',    val: totalExpired,   color:'text-error'    },
                { label:'Expiring 3d',val: expiringSoon,   color:'text-warning'  },
                { label:'Inventory Slots', val: myInventory.length, color:'text-primary' },
              ].map(t => (
                <div key={t.label} className="text-center">
                  <p className={`font-montserrat font-black text-xl ${t.color}`}>{t.val}</p>
                  <p className="text-[10px] text-base-content/40 uppercase tracking-wider font-semibold">{t.label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Components available ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Components handled */}
          <div className="card p-5">
            <h3 className="font-montserrat font-bold text-sm mb-4 flex items-center gap-2">
              <FlaskConical size={15} className="text-primary" /> Components Handled
            </h3>
            <div className="flex flex-wrap gap-2">
              {(myBank?.componentsHandled || []).map(c => (
                <motion.span key={c} whileHover={{ scale: 1.05 }}
                  className="badge badge-primary badge-sm cursor-default">
                  {c}
                </motion.span>
              ))}
              {(!myBank?.componentsHandled?.length) && <p className="text-xs text-base-content/30 italic">None configured</p>}
            </div>
          </div>

          {/* Services */}
          <div className="card p-5">
            <h3 className="font-montserrat font-bold text-sm mb-4 flex items-center gap-2">
              <Zap size={15} className="text-accent" /> Active Services
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {[
                { label:'Emergency 24×7',     active: myBank?.isEmergency24x7,           icon: Siren,       note:'Round-the-clock'    },
                { label:'Blood Delivery',     active: myBank?.offersDelivery,            icon: Truck,       note:`${myBank?.deliveryRadiusKm || 0}km radius` },
                { label:'Cross Matching',     active: myBank?.offersCrossMatch,          icon: Shield,      note:'Pre-transfusion'    },
                { label:'Component Sep.',     active: myBank?.offersComponentSeparation, icon: FlaskConical,note:'Apheresis'          },
                { label:'Accepts Donations',  active: myBank?.acceptsDonations,          icon: Heart,       note:'Walk-in donors'     },
                { label:'Mobile Unit',        active: myBank?.hasMobileUnit,             icon: Truck,       note:'Field collection'   },
              ].map(s => <ServiceBadge key={s.label} {...s} />)}
            </div>
          </div>
        </div>

        {/* ── Recent activity ── */}
        <div className="card p-5">
          <h3 className="font-montserrat font-bold text-sm mb-4 flex items-center gap-2">
            <Activity size={15} className="text-secondary" /> Recent Activity
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {[
              { label:'Last Donation',  val: myBank?.stats?.lastDonationAt,  icon: Heart,      color:'text-accent'   },
              { label:'Last Issuance',  val: myBank?.stats?.lastIssuanceAt,  icon: TrendingUp, color:'text-success'  },
              { label:'Rating',         val: myBank?.rating?.averageRating?.toFixed(1) + ' / 5', icon: Star, color:'text-warning' },
            ].map(a => (
              <div key={a.label} className="flex items-center gap-3 p-3 bg-base-200 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-base-300 flex items-center justify-center flex-shrink-0">
                  <a.icon size={16} className={a.color} />
                </div>
                <div>
                  <p className="text-xs text-base-content/45 font-semibold uppercase tracking-wider">{a.label}</p>
                  <p className="text-sm font-bold text-base-content">
                    {a.label === 'Rating'
                      ? a.val
                      : a.val ? new Date(a.val).toLocaleDateString('en-IN',{day:'2-digit',month:'short',year:'numeric'}) : '—'
                    }
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Contact quick-view ── */}
        <div className="card p-5">
          <h3 className="font-montserrat font-bold text-sm mb-3 flex items-center gap-2">
            <Phone size={15} className="text-primary" /> Contact & Location
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
            <div className="flex items-center gap-2 text-base-content/70">
              <Phone size={13} className="text-primary/60 flex-shrink-0" />
              <span>{myBank?.contact?.phone || '—'}</span>
            </div>
            <div className="flex items-center gap-2 text-base-content/70">
              <Siren size={13} className="text-error/60 flex-shrink-0" />
              <span>{myBank?.contact?.emergencyPhone || '—'}</span>
            </div>
            <div className="flex items-start gap-2 text-base-content/70">
              <MapPin size={13} className="text-primary/60 flex-shrink-0 mt-0.5" />
              <span className="text-xs leading-relaxed">
                {[myBank?.address?.line1, myBank?.address?.city, myBank?.address?.pincode].filter(Boolean).join(', ')}
              </span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}