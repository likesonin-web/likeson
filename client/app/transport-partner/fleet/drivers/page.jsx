'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users, UserPlus, UserMinus, Search, Filter, RefreshCw,
  CheckCircle2, XCircle, Clock, Shield, Star, Car,
  Phone, Mail, MapPin, Activity, ChevronRight, ChevronDown,
  AlertTriangle, Wifi, WifiOff, MoreVertical, Eye,
  TrendingUp, Award, Zap, Ban, X, Loader2,
  SlidersHorizontal, UserCheck, UserX,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import {
  fetchMyDrivers,
  linkDriver,
  unlinkDriver,
  selectMyDrivers,
  selectDriverSummary,
  selectFetchMyDriversOp,
  selectLinkDriverOp,
  selectUnlinkDriverOp,
  resetOp,
} from '@/store/slices/transportPartnerSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_META = {
  Available:  { label: 'Available',  color: '#22c55e', bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',  icon: Wifi      },
  'On-Trip':  { label: 'On Trip',    color: '#3b82f6', bg: 'bg-blue-500/10   text-blue-400   border-blue-500/20',       icon: Car       },
  Offline:    { label: 'Offline',    color: '#6b7280', bg: 'bg-gray-500/10   text-gray-400   border-gray-500/20',       icon: WifiOff   },
  'On-Break': { label: 'On Break',   color: '#f59e0b', bg: 'bg-amber-500/10  text-amber-400  border-amber-500/20',      icon: Clock     },
  Suspended:  { label: 'Suspended',  color: '#ef4444', bg: 'bg-red-500/10    text-red-400    border-red-500/20',        icon: Ban       },
};

const VERIFY_META = {
  Verified:     { label: 'Verified',      bg: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30', icon: CheckCircle2 },
  'Under-Review': { label: 'Under Review', bg: 'bg-amber-500/15   text-amber-300  border-amber-500/30',   icon: Clock       },
  Pending:      { label: 'KYC Pending',   bg: 'bg-gray-500/15    text-gray-300   border-gray-500/30',    icon: AlertTriangle },
  Rejected:     { label: 'Rejected',      bg: 'bg-red-500/15     text-red-300    border-red-500/30',     icon: XCircle     },
};

const TIER_COLORS = {
  Diamond:  'from-cyan-400 to-blue-500',
  Platinum: 'from-violet-400 to-purple-500',
  Gold:     'from-yellow-400 to-amber-500',
  Silver:   'from-gray-300  to-slate-400',
  Bronze:   'from-orange-400 to-amber-600',
};

const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
const fmtRating = (r) => r ? (+r).toFixed(1) : '—';

// ─── Sub-Components ───────────────────────────────────────────────────────────

const StatusPill = ({ status }) => {
  const m = STATUS_META[status] ?? STATUS_META.Offline;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${m.bg}`}>
      <Icon size={10} />
      {m.label}
    </span>
  );
};

const VerifyBadge = ({ status }) => {
  const m = VERIFY_META[status] ?? VERIFY_META.Pending;
  const Icon = m.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold border uppercase tracking-wide ${m.bg}`}>
      <Icon size={9} />
      {m.label}
    </span>
  );
};

const TierBadge = ({ tier }) => {
  const cls = TIER_COLORS[tier] ?? TIER_COLORS.Bronze;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-black bg-gradient-to-r ${cls} text-white`}>
      <Award size={9} />
      {tier}
    </span>
  );
};

const StatCard = ({ icon: Icon, label, value, accent, sub }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/[0.07] p-4 flex flex-col gap-2"
  >
    <div className="flex items-center justify-between">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-gray-400">{label}</span>
      <span className={`p-1.5 rounded-lg ${accent}`}><Icon size={13} /></span>
    </div>
    <span className="text-3xl font-black text-white tracking-tight">{value}</span>
    {sub && <span className="text-[11px] text-gray-500">{sub}</span>}
  </motion.div>
);

const Spinner = () => (
  <Loader2 size={15} className="animate-spin text-sky-400" />
);

// ─── Link Driver Modal ────────────────────────────────────────────────────────

const LinkDriverModal = ({ open, onClose, dispatch, linkOp }) => {
  const [driverId, setDriverId] = useState('');

  const handleSubmit = () => {
    if (!driverId.trim()) return;
    dispatch(linkDriver(driverId.trim())).then((res) => {
      if (!res.error) {
        dispatch(fetchMyDrivers());
        setDriverId('');
        onClose();
      }
    });
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md bg-[#0f1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="text-lg font-black text-white">Link Driver</h3>
                <p className="text-xs text-gray-400 mt-0.5">Enter the Driver ID to link to your agency</p>
              </div>
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400">
                <X size={16} />
              </button>
            </div>

            <label className="block text-xs font-semibold text-gray-400 mb-1.5 uppercase tracking-wider">Driver ID</label>
            <input
              value={driverId}
              onChange={(e) => setDriverId(e.target.value)}
              placeholder="MongoDB ObjectId of the driver"
              className="w-full bg-white/[0.04] border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-sky-500/50 focus:ring-1 focus:ring-sky-500/20 font-mono"
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
            />

            {linkOp.error && (
              <p className="mt-3 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{linkOp.error}</p>
            )}

            <div className="flex gap-3 mt-5">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/[0.03]">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!driverId.trim() || linkOp.loading}
                className="flex-1 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {linkOp.loading ? <><Spinner /> Linking…</> : <><UserPlus size={14} /> Link Driver</>}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Unlink Confirm Modal ─────────────────────────────────────────────────────

const UnlinkModal = ({ driver, onClose, dispatch, unlinkOp }) => {
  const handle = () => {
    dispatch(unlinkDriver(driver._id)).then((res) => {
      if (!res.error) onClose();
    });
  };

  return (
    <AnimatePresence>
      {driver && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.92, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 28 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm bg-[#0f1117] border border-white/10 rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-xl bg-red-500/15 border border-red-500/20">
                <UserMinus size={18} className="text-red-400" />
              </div>
              <div>
                <h3 className="text-base font-black text-white">Unlink Driver</h3>
                <p className="text-xs text-gray-400">This action can be undone</p>
              </div>
            </div>

            <p className="text-sm text-gray-300 mb-5">
              Remove <strong className="text-white">{driver.legalName || driver.user?.name || 'this driver'}</strong> ({driver.driverCode}) from your agency? Their account remains active.
            </p>

            {unlinkOp.error && (
              <p className="mb-4 text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">{unlinkOp.error}</p>
            )}

            <div className="flex gap-3">
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-white/10 text-sm text-gray-400 hover:bg-white/[0.03]">
                Keep
              </button>
              <button
                onClick={handle}
                disabled={unlinkOp.loading}
                className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-sm font-bold text-white disabled:opacity-40 flex items-center justify-center gap-2"
              >
                {unlinkOp.loading ? <><Spinner /> Removing…</> : 'Unlink'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─── Driver Detail Drawer ─────────────────────────────────────────────────────

const DriverDrawer = ({ driver, onClose, onUnlink }) => (
  <AnimatePresence>
    {driver && (
      <>
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
        />
        <motion.aside
          initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
          transition={{ type: 'spring', stiffness: 280, damping: 30 }}
          className="fixed right-0 top-0 h-full w-full max-w-md z-40 bg-[#0b0d11] border-l border-white/[0.07] overflow-y-auto flex flex-col"
        >
          {/* Header */}
          <div className="sticky top-0 bg-[#0b0d11]/95 backdrop-blur-md border-b border-white/[0.06] px-5 py-4 flex items-center justify-between">
            <span className="text-sm font-bold text-white">Driver Details</span>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-white/5 text-gray-400"><X size={15} /></button>
          </div>

          <div className="flex-1 p-5 space-y-5">
            {/* Avatar + core info */}
            <div className="flex items-start gap-4">
              <div className="relative flex-shrink-0">
                {driver.photoUrl || driver.user?.avatar ? (
                  <img src={driver.photoUrl || driver.user?.avatar} alt="" className="w-16 h-16 rounded-2xl object-cover ring-2 ring-white/10" />
                ) : (
                  <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-sky-600 to-indigo-700 flex items-center justify-center text-2xl font-black text-white">
                    {(driver.legalName || driver.user?.name || '?')[0]}
                  </div>
                )}
                <span className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-2 border-[#0b0d11] ${driver.user?.isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg font-black text-white truncate">{driver.legalName || driver.user?.name || '—'}</h2>
                <p className="text-xs font-mono text-sky-400 mt-0.5">{driver.driverCode || '—'}</p>
                <div className="flex flex-wrap gap-1.5 mt-2">
                  <StatusPill status={driver.status} />
                  <VerifyBadge status={driver.kyc?.verificationStatus || (driver.isVerified ? 'Verified' : 'Pending')} />
                  {driver.rewards?.tier && <TierBadge tier={driver.rewards.tier} />}
                </div>
              </div>
            </div>

            {/* Performance mini-stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Rating', value: fmtRating(driver.performance?.rating), icon: Star },
                { label: 'Rides', value: driver.performance?.totalRidesCompleted ?? '—', icon: Activity },
                { label: 'Completion', value: `${driver.profileCompletionPercent ?? 0}%`, icon: TrendingUp },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 text-center">
                  <Icon size={14} className="mx-auto mb-1 text-gray-500" />
                  <div className="text-lg font-black text-white">{value}</div>
                  <div className="text-[10px] text-gray-500 uppercase tracking-wide">{label}</div>
                </div>
              ))}
            </div>

            {/* Contact */}
            <Section title="Contact">
              <InfoRow icon={Phone} label="Phone" value={driver.phone || driver.user?.phone || '—'} />
              <InfoRow icon={Mail}  label="Email" value={driver.email || driver.user?.email || '—'} />
            </Section>

            {/* Vehicle assignment */}
            {driver.assignedVehicleSnapshot?.registrationNumber && (
              <Section title="Assigned Vehicle">
                <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-3 flex items-center gap-3">
                  <Car size={18} className="text-sky-400 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-bold text-white font-mono">{driver.assignedVehicleSnapshot.registrationNumber}</p>
                    <p className="text-xs text-gray-400">
                      {[driver.assignedVehicleSnapshot.make, driver.assignedVehicleSnapshot.model, driver.assignedVehicleSnapshot.vehicleType].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                </div>
              </Section>
            )}

            {/* Shift */}
            {driver.shift && (
              <Section title="Shift">
                <InfoRow icon={Clock} label="Type"    value={driver.shift.shiftType  || '—'} />
                <InfoRow icon={Clock} label="Hours"   value={`${driver.shift.startTime} – ${driver.shift.endTime}`} />
                <InfoRow icon={Zap}   label="Online?"  value={driver.shift.isAvailableNow ? 'Yes' : 'No'} />
              </Section>
            )}

            {/* KYC */}
            <Section title="KYC & Compliance">
              <InfoRow icon={Shield} label="DL Number" value={driver.kyc?.drivingLicenceNumber || '—'} mono />
              <InfoRow icon={Shield} label="DL Expiry"  value={fmtDate(driver.kyc?.drivingLicenceExpiry)} />
              <InfoRow icon={Shield} label="PSV Badge"  value={driver.kyc?.psvBadgeNumber || '—'} mono />
            </Section>

            {/* Badges */}
            {driver.rewards?.badges?.length > 0 && (
              <Section title="Badges">
                <div className="flex flex-wrap gap-2">
                  {driver.rewards.badges.map((b) => (
                    <span key={b.badgeId} className="text-[10px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-300 px-2 py-0.5 rounded">
                      {b.name}
                    </span>
                  ))}
                </div>
              </Section>
            )}
          </div>

          {/* Footer */}
          <div className="sticky bottom-0 bg-[#0b0d11]/95 backdrop-blur-md border-t border-white/[0.06] px-5 py-4">
            <button
              onClick={() => { onUnlink(driver); onClose(); }}
              className="w-full py-2.5 rounded-xl border border-red-500/30 text-sm font-bold text-red-400 hover:bg-red-500/10 flex items-center justify-center gap-2"
            >
              <UserMinus size={14} /> Unlink from Agency
            </button>
          </div>
        </motion.aside>
      </>
    )}
  </AnimatePresence>
);

const Section = ({ title, children }) => (
  <div>
    <h4 className="text-[10px] font-black uppercase tracking-widest text-gray-500 mb-2">{title}</h4>
    <div className="space-y-1.5">{children}</div>
  </div>
);

const InfoRow = ({ icon: Icon, label, value, mono }) => (
  <div className="flex items-center justify-between py-1.5 border-b border-white/[0.04] last:border-0">
    <span className="flex items-center gap-2 text-xs text-gray-500">
      <Icon size={11} />{label}
    </span>
    <span className={`text-xs text-gray-200 ${mono ? 'font-mono' : 'font-medium'}`}>{value}</span>
  </div>
);

// ─── Driver Card ──────────────────────────────────────────────────────────────

const DriverCard = ({ driver, index, onView, onUnlink }) => {
  const [menu, setMenu] = useState(false);
  const name = driver.legalName || driver.user?.name || 'Unknown';
  const avatar = driver.photoUrl || driver.user?.avatar;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04, type: 'spring', stiffness: 260, damping: 24 }}
      className="group relative bg-white/[0.025] hover:bg-white/[0.045] border border-white/[0.06] hover:border-white/[0.12] rounded-2xl p-4 transition-all duration-200 cursor-pointer"
      onClick={() => onView(driver)}
    >
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative flex-shrink-0">
          {avatar ? (
            <img src={avatar} alt="" className="w-11 h-11 rounded-xl object-cover" />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-700 to-indigo-800 flex items-center justify-center text-base font-black text-white">
              {name[0]}
            </div>
          )}
          <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#0b0d11] ${driver.user?.isOnline ? 'bg-emerald-400' : 'bg-gray-600'}`} />
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-bold text-white truncate">{name}</p>
              <p className="text-[10px] font-mono text-sky-400 truncate">{driver.driverCode || '—'}</p>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}
              className="p-1 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-300 flex-shrink-0"
            >
              <MoreVertical size={13} />
            </button>
          </div>

          <div className="flex flex-wrap gap-1.5 mt-2">
            <StatusPill status={driver.status} />
            <VerifyBadge status={driver.kyc?.verificationStatus || (driver.isVerified ? 'Verified' : 'Pending')} />
          </div>

          {/* Stats row */}
          <div className="flex items-center gap-3 mt-2.5 pt-2.5 border-t border-white/[0.05]">
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Star size={10} className="text-amber-400" />
              {fmtRating(driver.performance?.rating)}
            </span>
            <span className="flex items-center gap-1 text-[11px] text-gray-400">
              <Activity size={10} className="text-sky-400" />
              {driver.performance?.totalRidesCompleted ?? 0}
            </span>
            {driver.assignedVehicleSnapshot?.registrationNumber && (
              <span className="flex items-center gap-1 text-[11px] text-gray-400 font-mono truncate">
                <Car size={10} className="text-violet-400 flex-shrink-0" />
                <span className="truncate">{driver.assignedVehicleSnapshot.registrationNumber}</span>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Dropdown menu */}
      <AnimatePresence>
        {menu && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: -4 }}
            className="absolute top-10 right-4 z-20 bg-[#0f1117] border border-white/10 rounded-xl shadow-2xl py-1 min-w-[140px]"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => { setMenu(false); onView(driver); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-gray-300 hover:bg-white/[0.06] hover:text-white"
            >
              <Eye size={12} /> View Details
            </button>
            <button
              onClick={() => { setMenu(false); onUnlink(driver); }}
              className="w-full flex items-center gap-2.5 px-3.5 py-2 text-xs text-red-400 hover:bg-red-500/10"
            >
              <UserMinus size={12} /> Unlink Driver
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Performance Chart ────────────────────────────────────────────────────────

const PerformanceChart = ({ drivers }) => {
  const data = useMemo(() => {
    const top = [...drivers]
      .filter(d => d.performance?.totalRidesCompleted > 0)
      .sort((a, b) => (b.performance?.totalRidesCompleted ?? 0) - (a.performance?.totalRidesCompleted ?? 0))
      .slice(0, 6)
      .map(d => ({
        name: (d.legalName || d.user?.name || '?').split(' ')[0],
        rides: d.performance?.totalRidesCompleted ?? 0,
        rating: +(d.performance?.rating ?? 0).toFixed(1),
      }));
    return top;
  }, [drivers]);

  if (data.length < 2) return null;

  const CHART_COLORS = ['#38bdf8', '#818cf8', '#34d399', '#fb923c', '#a78bfa', '#f472b6'];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="bg-white/[0.025] border border-white/[0.06] rounded-2xl p-5"
    >
      <h3 className="text-xs font-black uppercase tracking-widest text-gray-400 mb-4">Top Performers — Rides Completed</h3>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart data={data} barSize={22}>
          <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#6b7280' }} axisLine={false} tickLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ background: '#0f1117', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, fontSize: 11 }}
            cursor={{ fill: 'rgba(255,255,255,0.03)' }}
            formatter={(v, n) => [v, n === 'rides' ? 'Rides' : 'Rating']}
          />
          <Bar dataKey="rides" radius={[4, 4, 0, 0]}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </motion.div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function DriversManagement() {
  const dispatch   = useDispatch();
  const drivers    = useSelector(selectMyDrivers);
  const summary    = useSelector(selectDriverSummary);
  const fetchOp    = useSelector(selectFetchMyDriversOp);
  const linkOp     = useSelector(selectLinkDriverOp);
  const unlinkOp   = useSelector(selectUnlinkDriverOp);

  // UI state
  const [search,       setSearch]       = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [verifyFilter, setVerifyFilter] = useState('all');
  const [viewDriver,   setViewDriver]   = useState(null);
  const [unlinkTarget, setUnlinkTarget] = useState(null);
  const [showLink,     setShowLink]     = useState(false);
  const [showFilters,  setShowFilters]  = useState(false);

  // Initial fetch
  useEffect(() => {
    dispatch(fetchMyDrivers());
    return () => {
      dispatch(resetOp('linkDriver'));
      dispatch(resetOp('unlinkDriver'));
    };
  }, [dispatch]);

  const refresh = useCallback(() => {
    dispatch(fetchMyDrivers({ status: statusFilter !== 'all' ? statusFilter : undefined }));
  }, [dispatch, statusFilter]);

  // Filtered list
  const filtered = useMemo(() => {
    let list = drivers;
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(d =>
        (d.legalName || d.user?.name || '').toLowerCase().includes(q) ||
        (d.driverCode || '').toLowerCase().includes(q) ||
        (d.phone || d.user?.phone || '').includes(q)
      );
    }
    if (statusFilter !== 'all') list = list.filter(d => d.status === statusFilter);
    if (verifyFilter !== 'all') {
      list = list.filter(d => {
        const vs = d.kyc?.verificationStatus || (d.isVerified ? 'Verified' : 'Pending');
        return vs === verifyFilter;
      });
    }
    return list;
  }, [drivers, search, statusFilter, verifyFilter]);

  const hasFilters = search || statusFilter !== 'all' || verifyFilter !== 'all';

  return (
    <div className="min-h-screen bg-[#080a0e] text-white font-sans">
      {/* Background texture */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(56,189,248,0.05),transparent)]" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImdyaWQiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTSAwIDEwIEwgNDAgMTAgTSAxMCAwIEwgMTAgNDAgTSAwIDIwIEwgNDAgMjAgTSAyMCAwIEwgMjAgNDAgTSAwIDMwIEwgNDAgMzAgTSAzMCAwIEwgMzAgNDAiIGZpbGw9Im5vbmUiIHN0cm9rZT0icmdiYSgyNTUsMjU1LDI1NSwwLjAyKSIgc3Ryb2tlLXdpZHRoPSIxIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2dyaWQpIi8+PC9zdmc+')] opacity-40" />
      </div>

      <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20">
                <Users size={18} className="text-sky-400" />
              </div>
              <h1 className="text-2xl font-black tracking-tight">Driver Management</h1>
            </div>
            <p className="text-sm text-gray-500 ml-11">Manage your agency's linked drivers</p>
          </div>

          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.93 }}
              onClick={refresh}
              disabled={fetchOp.loading}
              className="p-2.5 rounded-xl border border-white/[0.08] hover:bg-white/[0.04] text-gray-400 hover:text-white"
            >
              <RefreshCw size={14} className={fetchOp.loading ? 'animate-spin' : ''} />
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              whileHover={{ scale: 1.02 }}
              onClick={() => { dispatch(resetOp('linkDriver')); setShowLink(true); }}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-bold text-white"
            >
              <UserPlus size={14} /> Link Driver
            </motion.button>
          </div>
        </motion.div>

        {/* ── Stats row ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <StatCard icon={Users}     label="Total"    value={summary.total}           accent="bg-sky-500/10 text-sky-400"     sub="linked drivers" />
          <StatCard icon={UserCheck} label="Active"   value={summary.activeDrivers}   accent="bg-emerald-500/10 text-emerald-400" sub="on trip or available" />
          <StatCard icon={Shield}    label="Verified" value={summary.verifiedDrivers} accent="bg-violet-500/10 text-violet-400" sub="KYC approved" />
          <StatCard
            icon={TrendingUp}
            label="Unverified"
            value={summary.total - summary.verifiedDrivers}
            accent="bg-amber-500/10 text-amber-400"
            sub="pending KYC"
          />
        </div>

        {/* ── Performance chart ── */}
        {drivers.length > 1 && <div className="mb-6"><PerformanceChart drivers={drivers} /></div>}

        {/* ── Search + Filters ── */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, code, phone…"
              className="w-full bg-white/[0.03] border border-white/[0.07] rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-gray-600 outline-none focus:border-sky-500/40 focus:ring-1 focus:ring-sky-500/15"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                <X size={13} />
              </button>
            )}
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium ${hasFilters ? 'border-sky-500/40 text-sky-400 bg-sky-500/5' : 'border-white/[0.08] text-gray-400 hover:bg-white/[0.03]'}`}
          >
            <SlidersHorizontal size={13} />
            Filters
            {hasFilters && <span className="w-1.5 h-1.5 rounded-full bg-sky-400" />}
            <ChevronDown size={12} className={`transition-transform ${showFilters ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {/* Filter panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl p-4 flex flex-wrap gap-4">
                <FilterGroup
                  label="Status"
                  options={['all', ...Object.keys(STATUS_META)]}
                  active={statusFilter}
                  onChange={setStatusFilter}
                  labelMap={{ all: 'All Statuses', ...Object.fromEntries(Object.entries(STATUS_META).map(([k, v]) => [k, v.label])) }}
                />
                <FilterGroup
                  label="KYC"
                  options={['all', ...Object.keys(VERIFY_META)]}
                  active={verifyFilter}
                  onChange={setVerifyFilter}
                  labelMap={{ all: 'All KYC', ...Object.fromEntries(Object.entries(VERIFY_META).map(([k, v]) => [k, v.label])) }}
                />
                {hasFilters && (
                  <button
                    onClick={() => { setSearch(''); setStatusFilter('all'); setVerifyFilter('all'); }}
                    className="self-end text-xs text-gray-500 hover:text-white flex items-center gap-1"
                  >
                    <X size={11} /> Clear all
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Result label ── */}
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-gray-500">
            {filtered.length} {filtered.length === 1 ? 'driver' : 'drivers'}
            {hasFilters ? ' (filtered)' : ''}
          </span>
        </div>

        {/* ── Loading ── */}
        {fetchOp.loading && drivers.length === 0 && (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Loader2 size={28} className="animate-spin text-sky-400" />
            <p className="text-sm text-gray-500">Loading drivers…</p>
          </div>
        )}

        {/* ── Error ── */}
        {fetchOp.error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/20 rounded-xl mb-4">
            <AlertTriangle size={16} className="text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{fetchOp.error}</p>
          </div>
        )}

        {/* ── Empty state ── */}
        {!fetchOp.loading && filtered.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-4 text-center"
          >
            <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06]">
              {hasFilters ? <Filter size={28} className="text-gray-600" /> : <Users size={28} className="text-gray-600" />}
            </div>
            <div>
              <p className="font-bold text-gray-300">{hasFilters ? 'No drivers match' : 'No drivers linked'}</p>
              <p className="text-sm text-gray-500 mt-1">
                {hasFilters ? 'Try adjusting your filters' : 'Link a driver to get started'}
              </p>
            </div>
            {!hasFilters && (
              <button
                onClick={() => setShowLink(true)}
                className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-sm font-bold text-white"
              >
                <UserPlus size={14} /> Link First Driver
              </button>
            )}
          </motion.div>
        )}

        {/* ── Driver grid ── */}
        {filtered.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {filtered.map((d, i) => (
              <DriverCard
                key={d._id}
                driver={d}
                index={i}
                onView={setViewDriver}
                onUnlink={setUnlinkTarget}
              />
            ))}
          </div>
        )}
      </div>

      {/* ── Modals & Drawer ── */}
      <LinkDriverModal
        open={showLink}
        onClose={() => setShowLink(false)}
        dispatch={dispatch}
        linkOp={linkOp}
      />
      <UnlinkModal
        driver={unlinkTarget}
        onClose={() => { setUnlinkTarget(null); dispatch(resetOp('unlinkDriver')); }}
        dispatch={dispatch}
        unlinkOp={unlinkOp}
      />
      <DriverDrawer
        driver={viewDriver}
        onClose={() => setViewDriver(null)}
        onUnlink={(d) => { setViewDriver(null); setUnlinkTarget(d); }}
      />
    </div>
  );
}

// ─── Filter group helper ──────────────────────────────────────────────────────

function FilterGroup({ label, options, active, onChange, labelMap }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[10px] font-black uppercase tracking-widest text-gray-500">{label}</span>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
              active === opt
                ? 'bg-sky-500/20 border-sky-500/40 text-sky-300'
                : 'bg-white/[0.02] border-white/[0.07] text-gray-500 hover:text-gray-300'
            }`}
          >
            {labelMap?.[opt] ?? opt}
          </button>
        ))}
      </div>
    </div>
  );
}