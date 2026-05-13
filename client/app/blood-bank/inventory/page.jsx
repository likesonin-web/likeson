'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  RadialBarChart, RadialBar, ResponsiveContainer, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Cell,
} from 'recharts';
import {
  Droplets, Plus, Search, RefreshCw, ChevronRight,
  TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Layers, FlaskConical, X, ArrowUpRight, Package,
  Thermometer, Clock, MapPin, Activity, Archive,
  ShieldAlert, BellOff, CalendarCheck, Banknote,
  TestTube, Tag, User, Trash2, Lock,
} from 'lucide-react';
import {
  fetchMyInventory,
  createInventorySlot,
} from '@/store/slices/bloodbankSlice';

/* ─────────────────────────── CONSTANTS ─────────────────────────── */

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const COMPONENTS = [
  'Whole Blood', 'PRBC', 'FFP', 'Platelets', 'Cryoprecipitate',
  'Plasma', 'Single Donor Platelets', 'Leukoreduced PRBC',
  'Irradiated PRBC', 'Washed PRBC',
];

const STORAGE_LOCATIONS = [
  'Refrigerator_1', 'Refrigerator_2', 'Refrigerator_3',
  'Freezer_1', 'Freezer_2', 'Platelet_Agitator',
  'Room_Temperature', 'Transport_Box', 'Mobile_Unit',
];

const UNIT_STATUSES = [
  'available', 'reserved', 'cross_matching', 'cross_matched',
  'dispatched', 'issued', 'transfused', 'expired',
  'discarded', 'quarantined', 'recalled',
];

/** Shelf life in days per component (mirrors model constant) */
const COMPONENT_SHELF_LIFE_DAYS = {
  'Whole Blood': 35, 'PRBC': 42, 'FFP': 365,
  'Platelets': 5, 'Cryoprecipitate': 365, 'Plasma': 365,
  'Single Donor Platelets': 5, 'Leukoreduced PRBC': 42,
  'Irradiated PRBC': 28, 'Washed PRBC': 24,
};

/** Storage temp ranges per component */
const COMPONENT_STORAGE_TEMP = {
  'Whole Blood':            '2–6 °C',
  'PRBC':                   '2–6 °C',
  'FFP':                    '-25 to -18 °C',
  'Platelets':              '20–24 °C',
  'Cryoprecipitate':        '-25 to -18 °C',
  'Plasma':                 '-25 to -18 °C',
  'Single Donor Platelets': '20–24 °C',
  'Leukoreduced PRBC':      '2–6 °C',
  'Irradiated PRBC':        '2–6 °C',
  'Washed PRBC':            '2–6 °C',
};

const GROUP_COLORS = {
  'A+': '#ef4444', 'A-': '#f97316', 'B+': '#3b82f6', 'B-': '#6366f1',
  'AB+': '#8b5cf6', 'AB-': '#ec4899', 'O+': '#10b981', 'O-': '#14b8a6',
};

const COMP_SHORT = {
  'Whole Blood': 'WB', 'PRBC': 'PRBC', 'FFP': 'FFP',
  'Platelets': 'PLT', 'Cryoprecipitate': 'CRYO', 'Plasma': 'PLS',
  'Single Donor Platelets': 'SDP', 'Leukoreduced PRBC': 'LR-PRBC',
  'Irradiated PRBC': 'IR-PRBC', 'Washed PRBC': 'WA-PRBC',
};

/* ─────────────────────────── ANIMATION VARIANTS ─────────────────── */

const container = { hidden: {}, show: { transition: { staggerChildren: 0.055 } } };
const item = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [.4, 0, .2, 1] } },
};

/* ─────────────────────────── HELPERS ────────────────────────────── */

function fmt(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtTime(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* ────────────── NOTE LABEL ────────────────────────────────────────
   Small grey helper text shown below each field value.
   Mirrors the schema comments so staff understand data meaning.
──────────────────────────────────────────────────────────────────── */
function NoteLabel({ text }) {
  return (
    <p className="text-[9px] text-base-content/40 leading-tight mt-0.5">{text}</p>
  );
}

/* ─────────────────────────── STAT PILL ──────────────────────────── */

function StatPill({ label, value, icon: Icon, color, sub, note }) {
  return (
    <motion.div variants={item}
      className="stat-card flex flex-col gap-1 relative overflow-hidden group cursor-default">
      <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"
        style={{ background: `linear-gradient(135deg,${color}08,${color}14)` }} />
      <div className="flex items-start justify-between">
        <div className="w-9 h-9 rounded-xl flex items-center justify-center"
          style={{ background: `${color}18` }}>
          <Icon className="w-4.5 h-4.5" style={{ color }} />
        </div>
        {sub !== undefined && (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${sub >= 0 ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
            {sub >= 0 ? <TrendingUp className="w-3 h-3 inline mr-0.5" /> : <TrendingDown className="w-3 h-3 inline mr-0.5" />}
            {Math.abs(sub)}
          </span>
        )}
      </div>
      <p className="stat-card-value" style={{ color }}>{value ?? '—'}</p>
      <p className="stat-card-label">{label}</p>
      {note && <NoteLabel text={note} />}
    </motion.div>
  );
}

/* ─────────────────────────── INVENTORY CARD ─────────────────────── */

function InventoryCard({ inv, onClick }) {
  const pct = inv.totalUnits > 0 ? Math.round((inv.availableUnits / Math.max(inv.totalUnits, 1)) * 100) : 0;
  const color = GROUP_COLORS[inv.bloodGroup] ?? 'var(--primary)';
  const statusColor = inv.isCriticalStock ? 'error' : inv.isLowStock ? 'warning' : 'success';
  const statusLabel = inv.isCriticalStock ? 'Critical' : inv.isLowStock ? 'Low Stock' : 'Adequate';

  return (
    <motion.div variants={item} whileHover={{ y: -3, scale: 1.01 }} whileTap={{ scale: .98 }}
      onClick={() => onClick(inv)}
      className="glass-card p-4 cursor-pointer group relative overflow-hidden">

      {/* blood group accent bar — color from GROUP_COLORS map */}
      <div className="absolute top-0 left-0 w-1 h-full rounded-l-xl" style={{ background: color }} />

      {/* Header: blood group badge + component name + stock status */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5">
          {/* bloodGroup field — 8 ABO+Rh types */}
          <div className="w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm text-white shadow-md"
            style={{ background: color }}>
            {inv.bloodGroup}
          </div>
          <div>
            {/* component field — 10 blood product types */}
            <p className="text-xs font-bold text-base-content/50 uppercase tracking-wide">
              {COMP_SHORT[inv.component] ?? inv.component}
            </p>
            <p className="text-sm font-semibold text-base-content leading-tight">{inv.component}</p>
            <NoteLabel text="1 doc per bloodGroup+component combo" />
          </div>
        </div>
        {/* isLowStock / isCriticalStock flags — set by scheduled job */}
        <span className={`badge badge-${statusColor} badge-sm`}>{statusLabel}</span>
      </div>

      {/* availableUnits / totalUnits ratio */}
      <div className="mb-3">
        <div className="flex justify-between text-[10px] text-base-content/50 mb-1">
          <span>Available / Total</span><span>{pct}%</span>
        </div>
        <div className="progress-bar h-1.5">
          <motion.div className="progress-bar-fill h-full"
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ duration: .8, ease: 'easeOut', delay: .2 }}
            style={{ background: color }} />
        </div>
        <NoteLabel text="availableUnits = total − reserved − issued − expired" />
      </div>

      {/* Counter grid — 4 key stock counters */}
      <div className="grid grid-cols-4 gap-1 text-center mb-2">
        {[
          { label: 'Avail', val: inv.availableUnits, c: 'text-success', note: 'availableUnits' },
          { label: 'Rsrvd', val: inv.reservedUnits, c: 'text-warning', note: 'reservedUnits' },
          { label: 'Issued', val: inv.issuedUnits, c: 'text-info', note: 'issuedUnits' },
          { label: 'Exprd', val: inv.expiredUnits, c: 'text-error', note: 'expiredUnits' },
        ].map(({ label, val, c, note }) => (
          <div key={label} className="bg-base-200/60 rounded-lg py-1.5 px-1">
            <p className={`text-base font-black ${c}`}>{val ?? 0}</p>
            <p className="text-[9px] text-base-content/40 uppercase tracking-wide">{label}</p>
            <NoteLabel text={note} />
          </div>
        ))}
      </div>

      {/* cityName + nextExpiryAt quick info */}
      <div className="flex items-center justify-between mt-1">
        {inv.cityName && (
          <div className="flex items-center gap-1 text-[10px] text-base-content/40">
            <MapPin className="w-3 h-3" />
            <span>{inv.cityName}</span>
          </div>
        )}
        {inv.nextExpiryAt && (
          <div className="flex items-center gap-1.5 text-[11px] text-warning">
            <AlertTriangle className="w-3 h-3 flex-shrink-0" />
            <span className="font-semibold">Expires {fmt(inv.nextExpiryAt)}</span>
          </div>
        )}
      </div>

      <div className="absolute right-3 bottom-3 opacity-0 group-hover:opacity-100 transition-opacity">
        <ChevronRight className="w-4 h-4 text-base-content/30" />
      </div>
    </motion.div>
  );
}

/* ─────────────────────────── CREATE SLOT MODAL ─────────────────── */

function CreateSlotModal({ open, onClose }) {
  const dispatch = useDispatch();
  const { loading } = useSelector(s => s.bloodBank);
  const [form, setForm] = useState({
    bloodGroup: 'A+',
    component: 'Whole Blood',
    processingFeePerUnit: 0,
    crossMatchFeePerUnit: 0,
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(createInventorySlot(form));
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-neutral/50 backdrop-blur-sm" onClick={onClose} />
          <motion.div
            initial={{ opacity: 0, scale: .94, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: .94, y: 20 }}
            transition={{ duration: .22, ease: [.4, 0, .2, 1] }}
            className="relative bg-base-100 rounded-2xl border border-base-300/60 shadow-depth-lg w-full max-w-md p-6 z-10">

            <div className="flex items-center justify-between mb-5">
              <div>
                <h3 className="font-montserrat font-black text-xl text-base-content">New Inventory Slot</h3>
                <p className="text-sm text-base-content/50 mt-0.5">
                  One slot per bloodGroup + component combination
                </p>
                <NoteLabel text="Unique constraint: bloodBank + bloodGroup + component" />
              </div>
              <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-300/60 transition-colors">
                <X className="w-4 h-4 text-base-content/60" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">

              {/* bloodGroup */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">
                    <span className="label-text">Blood Group</span>
                  </label>
                  <select value={form.bloodGroup} onChange={e => set('bloodGroup', e.target.value)}
                    className="input-field">
                    {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                  </select>
                  <NoteLabel text="ABO + Rh type. Enum: A+/A-/B+/B-/AB+/AB-/O+/O-" />
                </div>

                {/* component */}
                <div>
                  <label className="label mb-1">
                    <span className="label-text">Component</span>
                  </label>
                  <select value={form.component} onChange={e => set('component', e.target.value)}
                    className="input-field">
                    {COMPONENTS.map(c => <option key={c}>{c}</option>)}
                  </select>
                  <NoteLabel text={`Shelf life: ${COMPONENT_SHELF_LIFE_DAYS[form.component] ?? '—'} days. Temp: ${COMPONENT_STORAGE_TEMP[form.component] ?? '—'}`} />
                </div>
              </div>

              {/* processingFeePerUnit + crossMatchFeePerUnit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label mb-1">
                    <span className="label-text">Processing Fee (₹)</span>
                  </label>
                  <input type="number" min="0" value={form.processingFeePerUnit}
                    onChange={e => set('processingFeePerUnit', +e.target.value)}
                    className="input-field" />
                  <NoteLabel text="processingFeePerUnit — synced from BloodBank.pricing on update" />
                </div>
                <div>
                  <label className="label mb-1">
                    <span className="label-text">CrossMatch Fee (₹)</span>
                  </label>
                  <input type="number" min="0" value={form.crossMatchFeePerUnit}
                    onChange={e => set('crossMatchFeePerUnit', +e.target.value)}
                    className="input-field" />
                  <NoteLabel text="crossMatchFeePerUnit — added to Razorpay order total" />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
                <button type="submit" disabled={loading} className="btn btn-primary flex-1">
                  {loading ? <span className="loading loading-sm loading-spinner" /> : 'Create Slot'}
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── UNIT ROW (inside drawer) ─────────────
   Displays all bloodUnitSchema fields with note labels.
──────────────────────────────────────────────────────────────────── */

function UnitRow({ unit }) {
  const statusColor = {
    available: 'success', reserved: 'warning', cross_matching: 'info',
    cross_matched: 'info', dispatched: 'secondary', issued: 'secondary',
    transfused: 'neutral', expired: 'error', discarded: 'error',
    quarantined: 'warning', recalled: 'error',
  }[unit.status] ?? 'neutral';

  const allTests = ['hiv', 'hbsAg', 'hcv', 'syphilis', 'malaria'];
  const testClear = unit.testResults?.allClear;

  return (
    <div className="border border-base-300/60 rounded-xl p-3 mb-2 text-xs bg-base-200/40">
      {/* Row 1: identity + status */}
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="font-black text-sm text-base-content">{unit.bagNumber}</p>
          <NoteLabel text="bagNumber — unique physical bag label (uppercase)" />
        </div>
        <span className={`badge badge-${statusColor} badge-xs`}>{unit.status}</span>
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-2">

        {/* donorCode */}
        <div>
          <p className="text-base-content/60 font-semibold">Donor Code</p>
          <p className="font-bold text-base-content">{unit.donorCode ?? '—'}</p>
          <NoteLabel text="donorCode — string ref, no FK. WALK-IN for unregistered" />
        </div>

        {/* donorName */}
        <div>
          <p className="text-base-content/60 font-semibold">Donor Name</p>
          <p className="font-bold text-base-content">{unit.donorName ?? '—'}</p>
          <NoteLabel text="donorName — optional display only" />
        </div>

        {/* collectedAt */}
        <div>
          <p className="text-base-content/60 font-semibold">Collected At</p>
          <p className="font-bold text-base-content">{fmt(unit.collectedAt)}</p>
          <NoteLabel text="collectedAt — required. Blood draw timestamp" />
        </div>

        {/* volumeMl */}
        <div>
          <p className="text-base-content/60 font-semibold">Volume</p>
          <p className="font-bold text-base-content">{unit.volumeMl ? `${unit.volumeMl} mL` : '—'}</p>
          <NoteLabel text="volumeMl — 50–500 mL range allowed" />
        </div>

        {/* collectedByStaff */}
        <div>
          <p className="text-base-content/60 font-semibold">Collected By</p>
          <p className="font-bold text-base-content">{unit.collectedByStaff ?? '—'}</p>
          <NoteLabel text="collectedByStaff — staff name string" />
        </div>

        {/* donorHemoglobin */}
        <div>
          <p className="text-base-content/60 font-semibold">Hemoglobin</p>
          <p className="font-bold text-base-content">{unit.donorHemoglobin != null ? `${unit.donorHemoglobin} g/dL` : '—'}</p>
          <NoteLabel text="donorHemoglobin — donor Hb at time of donation" />
        </div>

        {/* processedAt + processedBy */}
        <div>
          <p className="text-base-content/60 font-semibold">Processed At</p>
          <p className="font-bold text-base-content">{fmt(unit.processedAt)}</p>
          <NoteLabel text="processedAt — component separation timestamp" />
        </div>
        <div>
          <p className="text-base-content/60 font-semibold">Processed By</p>
          <p className="font-bold text-base-content">{unit.processedBy ?? '—'}</p>
          <NoteLabel text="processedBy — lab tech name" />
        </div>

        {/* separationMethod */}
        <div className="col-span-2">
          <p className="text-base-content/60 font-semibold">Separation Method</p>
          <p className="font-bold text-base-content">{unit.separationMethod ?? '—'}</p>
          <NoteLabel text="separationMethod — Whole_Blood_Filtration / Apheresis / Centrifugation / Not_Applicable" />
        </div>

        {/* expiresAt */}
        <div>
          <p className="text-base-content/60 font-semibold">Expires At</p>
          <p className={`font-bold ${unit.expiresAt && new Date(unit.expiresAt) < new Date() ? 'text-error' : 'text-base-content'}`}>
            {fmt(unit.expiresAt)}
          </p>
          <NoteLabel text="expiresAt — required, indexed. Auto-expired by runExpiryCheck()" />
        </div>

        {/* storageLocation */}
        <div>
          <p className="text-base-content/60 font-semibold">Storage Location</p>
          <p className="font-bold text-base-content">{unit.storageLocation ?? '—'}</p>
          <NoteLabel text="storageLocation — enum: Refrigerator_1…Mobile_Unit" />
        </div>

        {/* storageSlot */}
        <div>
          <p className="text-base-content/60 font-semibold">Storage Slot</p>
          <p className="font-bold text-base-content">{unit.storageSlot ?? '—'}</p>
          <NoteLabel text="storageSlot — physical rack/slot identifier" />
        </div>

        {/* storageTemperatureC */}
        <div>
          <p className="text-base-content/60 font-semibold">Storage Temp</p>
          <p className="font-bold text-base-content">
            {unit.storageTemperatureC != null ? `${unit.storageTemperatureC} °C` : '—'}
          </p>
          <NoteLabel text="storageTemperatureC — actual recorded temp" />
        </div>

        {/* isTestingComplete + isReleaseApproved */}
        <div>
          <p className="text-base-content/60 font-semibold">Testing Done</p>
          <p className={`font-bold ${unit.isTestingComplete ? 'text-success' : 'text-warning'}`}>
            {unit.isTestingComplete ? 'Yes' : 'Pending'}
          </p>
          <NoteLabel text="isTestingComplete — all NACO/ELISA screens done" />
        </div>
        <div>
          <p className="text-base-content/60 font-semibold">Released</p>
          <p className={`font-bold ${unit.isReleaseApproved ? 'text-success' : 'text-error'}`}>
            {unit.isReleaseApproved ? 'Approved' : 'Held'}
          </p>
          <NoteLabel text="isReleaseApproved — bank manager approval before issue" />
        </div>

        {/* testResults */}
        <div className="col-span-2">
          <p className="text-base-content/60 font-semibold mb-1">
            Test Results
            {testClear != null && (
              <span className={`ml-2 badge badge-xs ${testClear ? 'badge-success' : 'badge-error'}`}>
                {testClear ? 'All Clear' : 'Reactive'}
              </span>
            )}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {['hiv', 'hbsAg', 'hcv', 'syphilis', 'malaria'].map(k => {
              const val = unit.testResults?.[k] ?? 'Pending';
              const c = val === 'Non-Reactive' ? 'badge-success' : val === 'Reactive' ? 'badge-error' : 'badge-warning';
              return (
                <span key={k} className={`badge badge-xs ${c}`}>
                  {k.toUpperCase()}: {val}
                </span>
              );
            })}
          </div>
          <NoteLabel text="testResults — HIV/HBsAg/HCV/Syphilis/Malaria: Non-Reactive|Reactive|Pending|Not_Done" />
        </div>

        {/* crossMatch */}
        {unit.crossMatch?.result && (
          <div className="col-span-2">
            <p className="text-base-content/60 font-semibold">Cross-Match</p>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`badge badge-xs ${unit.crossMatch.result === 'Compatible' ? 'badge-success' : 'badge-error'}`}>
                {unit.crossMatch.result}
              </span>
              {unit.crossMatch.resultAt && (
                <span className="text-base-content/40">{fmt(unit.crossMatch.resultAt)}</span>
              )}
            </div>
            <NoteLabel text="crossMatch — Compatible|Incompatible|Pending. Links to BloodRequest" />
          </div>
        )}

        {/* issuedTo */}
        {unit.issuedTo?.issuedAt && (
          <div className="col-span-2 bg-info/5 rounded-lg p-2 border border-info/20">
            <p className="text-base-content/60 font-semibold">Issued</p>
            <p className="font-bold text-base-content">{fmt(unit.issuedTo.issuedAt)} by {unit.issuedTo.issuedBy ?? '—'}</p>
            <NoteLabel text="issuedTo — request/hospital/issuedAt/issuedBy/receiptUrl" />
          </div>
        )}

        {/* transfusedAt */}
        {unit.transfusedAt && (
          <div>
            <p className="text-base-content/60 font-semibold">Transfused</p>
            <p className="font-bold text-success">{fmt(unit.transfusedAt)}</p>
            <NoteLabel text="transfusedAt — patient administration timestamp" />
          </div>
        )}

        {/* isRecalled */}
        {unit.isRecalled && (
          <div className="col-span-2 bg-error/5 rounded-lg p-2 border border-error/20">
            <div className="flex items-center gap-1.5 text-error font-bold">
              <ShieldAlert className="w-3 h-3" />
              RECALLED
            </div>
            <p className="text-base-content/60 mt-0.5">{unit.recallReason ?? '—'}</p>
            {unit.recalledAt && <p className="text-base-content/40 text-[9px]">{fmt(unit.recalledAt)}</p>}
            <NoteLabel text="isRecalled + recallReason + recalledAt — post-issue safety recall" />
          </div>
        )}
      </div>
    </div>
  );
}

/* ─────────────────────────── INVENTORY DETAIL DRAWER ─────────────── */

function InventoryDetailDrawer({ inv, onClose }) {
  const [tab, setTab] = useState('overview'); // 'overview' | 'units' | 'audit'

  if (!inv) return null;
  const color = GROUP_COLORS[inv.bloodGroup] ?? 'var(--primary)';

  const chartData = [
    { name: 'Available', value: inv.availableUnits ?? 0, fill: 'var(--success)' },
    { name: 'Reserved', value: inv.reservedUnits ?? 0, fill: 'var(--warning)' },
    { name: 'Issued', value: inv.issuedUnits ?? 0, fill: 'var(--info)' },
    { name: 'Expired', value: inv.expiredUnits ?? 0, fill: 'var(--error)' },
    { name: 'Discarded', value: inv.discardedUnits ?? 0, fill: 'var(--neutral)' },
    { name: 'Quarantined', value: inv.quarantinedUnits ?? 0, fill: 'oklch(72% 0.17 72)' },
  ].filter(d => d.value > 0);

  return (
    <AnimatePresence>
      {inv && (
        <motion.div className="fixed inset-0 z-50 flex justify-end"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <motion.div className="absolute inset-0 bg-neutral/40 backdrop-blur-sm" onClick={onClose} />
          <motion.aside
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            transition={{ duration: .28, ease: [.4, 0, .2, 1] }}
            className="relative bg-base-100 border-l border-base-300/60 w-full max-w-md h-full overflow-y-auto z-10 flex flex-col">

            {/* Sticky header */}
            <div className="sticky top-0 z-10 bg-base-100 border-b border-base-300/60 p-5 pb-0">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center font-black text-white shadow-md"
                    style={{ background: color }}>
                    {inv.bloodGroup}
                  </div>
                  <div>
                    <h3 className="font-montserrat font-black text-lg text-base-content">{inv.bloodGroup}</h3>
                    <p className="text-xs text-base-content/50">{inv.component}</p>
                    <NoteLabel text={`Shelf life: ${COMPONENT_SHELF_LIFE_DAYS[inv.component] ?? '—'} days · ${COMPONENT_STORAGE_TEMP[inv.component] ?? '—'}`} />
                  </div>
                </div>
                <button onClick={onClose} className="p-2 rounded-xl hover:bg-base-300/60">
                  <X className="w-4 h-4 text-base-content/60" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-0">
                {['overview', 'units', 'audit'].map(t => (
                  <button key={t}
                    onClick={() => setTab(t)}
                    className={`px-3 py-1.5 text-xs font-bold rounded-t-lg capitalize transition-colors ${tab === t
                        ? 'bg-base-200 text-base-content border-t border-x border-base-300/60'
                        : 'text-base-content/40 hover:text-base-content'
                      }`}>
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-5 flex flex-col gap-4 flex-1">

              {/* ── OVERVIEW TAB ── */}
              {tab === 'overview' && (
                <>
                  {/* Stock counters — all 7 counter fields */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">
                      Stock Counters
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { l: 'Total Units', v: inv.totalUnits ?? 0, note: 'totalUnits — all bags ever added', c: 'text-base-content' },
                        { l: 'Available', v: inv.availableUnits ?? 0, note: 'availableUnits — released, not reserved', c: 'text-success' },
                        { l: 'Reserved', v: inv.reservedUnits ?? 0, note: 'reservedUnits — atomically $inc by reserveUnits()', c: 'text-warning' },
                        { l: 'Issued', v: inv.issuedUnits ?? 0, note: 'issuedUnits — dispatched to patient', c: 'text-info' },
                        { l: 'Expired', v: inv.expiredUnits ?? 0, note: 'expiredUnits — marked by runExpiryCheck()', c: 'text-error' },
                        { l: 'Discarded', v: inv.discardedUnits ?? 0, note: 'discardedUnits — contaminated or damaged', c: 'text-error' },
                        { l: 'Quarantined', v: inv.quarantinedUnits ?? 0, note: 'quarantinedUnits — held for investigation', c: 'text-warning' },
                      ].map(({ l, v, note, c }) => (
                        <div key={l} className="bg-base-200/60 rounded-xl p-2.5">
                          <p className="text-[10px] text-base-content/40 uppercase tracking-wide">{l}</p>
                          <p className={`text-lg font-black mt-0.5 ${c}`}>{v}</p>
                          <NoteLabel text={note} />
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Chart — unit distribution */}
                  {chartData.length > 0 && (
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Unit Distribution</p>
                      <div className="h-40">
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={chartData} barSize={28}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--base-300)" vertical={false} />
                            <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: .5 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 9, fill: 'var(--base-content)', opacity: .5 }} axisLine={false} tickLine={false} />
                            <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }} />
                            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                              {chartData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                            </Bar>
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  )}

                  {/* Expiry section */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Expiry Tracking</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-base-200/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-base-content/40 uppercase">Next Expiry</p>
                        <p className={`text-sm font-bold mt-0.5 ${inv.nextExpiryAt ? 'text-warning' : 'text-base-content'}`}>
                          {fmt(inv.nextExpiryAt)}
                        </p>
                        <NoteLabel text="nextExpiryAt — earliest expiry among available units (indexed)" />
                      </div>
                      <div className="bg-base-200/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-base-content/40 uppercase">Expiring 3d / 7d</p>
                        <p className={`text-sm font-bold mt-0.5 ${inv.expiringIn3Days > 0 ? 'text-error' : 'text-base-content'}`}>
                          {inv.expiringIn3Days ?? 0} / {inv.expiringIn7Days ?? 0} units
                        </p>
                        <NoteLabel text="expiringIn3Days / expiringIn7Days — recomputed on expiry check" />
                      </div>
                    </div>
                    {(inv.expiringIn3Days > 0 || inv.expiringIn7Days > 0) && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-warning/10 border border-warning/30 mt-2">
                        <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
                        <p className="text-xs font-semibold text-warning">
                          {inv.expiringIn3Days} bag{inv.expiringIn3Days !== 1 ? 's' : ''} expire within 3 days!
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Pricing */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Pricing</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-base-200/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-base-content/40 uppercase">Processing Fee</p>
                        <p className="text-sm font-bold mt-0.5 text-base-content">₹ {inv.processingFeePerUnit ?? 0}</p>
                        <NoteLabel text="processingFeePerUnit — per bag, synced from BloodBank.pricing" />
                      </div>
                      <div className="bg-base-200/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-base-content/40 uppercase">CrossMatch Fee</p>
                        <p className="text-sm font-bold mt-0.5 text-base-content">₹ {inv.crossMatchFeePerUnit ?? 0}</p>
                        <NoteLabel text="crossMatchFeePerUnit — added to Razorpay order" />
                      </div>
                    </div>
                  </div>

                  {/* Stock alert state */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Alert State</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className={`rounded-xl p-2.5 border ${inv.isCriticalStock ? 'bg-error/10 border-error/30' : 'bg-base-200/60 border-base-300/40'}`}>
                        <div className="flex items-center gap-1.5">
                          <ShieldAlert className={`w-3.5 h-3.5 ${inv.isCriticalStock ? 'text-error' : 'text-base-content/30'}`} />
                          <p className="text-[10px] text-base-content/40 uppercase">Critical Stock</p>
                        </div>
                        <p className={`text-sm font-bold mt-0.5 ${inv.isCriticalStock ? 'text-error' : 'text-base-content/40'}`}>
                          {inv.isCriticalStock ? 'YES — Act now' : 'No'}
                        </p>
                        <NoteLabel text="isCriticalStock — below criticalThreshold in stockAlerts config" />
                      </div>
                      <div className={`rounded-xl p-2.5 border ${inv.isLowStock ? 'bg-warning/10 border-warning/30' : 'bg-base-200/60 border-base-300/40'}`}>
                        <div className="flex items-center gap-1.5">
                          <AlertTriangle className={`w-3.5 h-3.5 ${inv.isLowStock ? 'text-warning' : 'text-base-content/30'}`} />
                          <p className="text-[10px] text-base-content/40 uppercase">Low Stock</p>
                        </div>
                        <p className={`text-sm font-bold mt-0.5 ${inv.isLowStock ? 'text-warning' : 'text-base-content/40'}`}>
                          {inv.isLowStock ? 'YES — Reorder' : 'No'}
                        </p>
                        <NoteLabel text="isLowStock — below minThreshold in stockAlerts config" />
                      </div>
                    </div>
                    {inv.lastAlertSentAt && (
                      <div className="mt-2 bg-base-200/60 rounded-xl p-2.5">
                        <p className="text-[10px] text-base-content/40 uppercase">Last Alert Sent</p>
                        <p className="text-sm font-bold mt-0.5 text-base-content">{fmtTime(inv.lastAlertSentAt)}</p>
                        <NoteLabel text="lastAlertSentAt — prevents duplicate alert spam" />
                      </div>
                    )}
                  </div>

                  {/* Location */}
                  <div>
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-2">Location</p>
                    <div className="bg-base-200/60 rounded-xl p-2.5 flex items-start gap-2">
                      <MapPin className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                      <div>
                        <p className="text-sm font-bold text-base-content">
                          {inv.cityName ?? '—'}
                        </p>
                        {inv.location?.coordinates && (
                          <p className="text-xs text-base-content/40">
                            [{inv.location.coordinates[1]?.toFixed(4)}, {inv.location.coordinates[0]?.toFixed(4)}]
                          </p>
                        )}
                        <NoteLabel text="location — 2dsphere GeoJSON Point, denormalized from BloodBank for fast $near queries" />
                        <NoteLabel text="cityName — string copy from BloodBank.address.city" />
                      </div>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="flex gap-2 mt-auto pt-2">
                    <a href={`/blood-bank/units?invId=${inv._id}`} className="btn btn-outline flex-1 text-sm">
                      View Units
                    </a>
                    <a href={`/blood-bank/expiry?invId=${inv._id}`} className="btn btn-primary flex-1 text-sm">
                      Run Expiry Check
                    </a>
                  </div>
                </>
              )}

              {/* ── UNITS TAB ── */}
              {tab === 'units' && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">
                      Blood Units ({(inv.units ?? []).length} / 500 max)
                    </p>
                    <NoteLabel text="units[] — capped at 500 per inventory doc" />
                  </div>
                  {(inv.units ?? []).length === 0 ? (
                    <div className="text-center py-10 text-base-content/30">
                      <TestTube className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No units added yet</p>
                      <NoteLabel text="Add bags via POST /me/inventory/:invId/units" />
                    </div>
                  ) : (
                    (inv.units ?? []).map((u, i) => <UnitRow key={u._id ?? i} unit={u} />)
                  )}
                </div>
              )}

              {/* ── AUDIT TAB ── */}
              {tab === 'audit' && (
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Audit Fields</p>

                  {[
                    { l: 'Last Updated', v: fmtTime(inv.lastUpdatedAt), note: 'lastUpdatedAt — set on any counter change or unit mutation' },
                    { l: 'Last Donation', v: fmtTime(inv.lastDonationAt), note: 'lastDonationAt — set when addUnit() is called' },
                    { l: 'Last Issuance', v: fmtTime(inv.lastIssuanceAt), note: 'lastIssuanceAt — set when units are marked issued' },
                    { l: 'Created By', v: inv.createdBy ?? '—', note: 'createdBy — User ObjectId ref' },
                    { l: 'Updated By', v: inv.updatedBy ?? '—', note: 'updatedBy — User ObjectId ref, last modifier' },
                    { l: 'Document ID', v: inv._id, note: '_id — MongoDB ObjectId for this inventory slot' },
                    { l: 'BloodBank Ref', v: inv.bloodBank, note: 'bloodBank — ObjectId ref to BloodBank parent doc' },
                  ].map(({ l, v, note }) => (
                    <div key={l} className="bg-base-200/60 rounded-xl p-3">
                      <p className="text-[10px] text-base-content/40 uppercase tracking-wide">{l}</p>
                      <p className="text-sm font-bold text-base-content mt-0.5 break-all">{v ?? '—'}</p>
                      <NoteLabel text={note} />
                    </div>
                  ))}

                  {/* Timestamps from mongoose */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-base-200/60 rounded-xl p-2.5">
                      <p className="text-[10px] text-base-content/40 uppercase">Created</p>
                      <p className="text-sm font-bold mt-0.5">{fmtTime(inv.createdAt)}</p>
                      <NoteLabel text="createdAt — mongoose timestamps auto-field" />
                    </div>
                    <div className="bg-base-200/60 rounded-xl p-2.5">
                      <p className="text-[10px] text-base-content/40 uppercase">Updated</p>
                      <p className="text-sm font-bold mt-0.5">{fmtTime(inv.updatedAt)}</p>
                      <NoteLabel text="updatedAt — mongoose timestamps auto-field" />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─────────────────────────── PAGE ──────────────────────────────── */

export default function InventoryPage() {
  const dispatch = useDispatch();
  const { myInventory, loading } = useSelector(s => s.bloodBank);

  const [search, setSearch] = useState('');
  const [filterGroup, setFilterGroup] = useState('');
  const [filterComp, setFilterComp] = useState('');
  const [filterAlert, setFilterAlert] = useState(''); // 'critical' | 'low' | ''
  const [showCreate, setShowCreate] = useState(false);
  const [selected, setSelected] = useState(null);

  useEffect(() => { dispatch(fetchMyInventory()); }, [dispatch]);

  const filtered = (myInventory ?? []).filter(inv => {
    const q = search.toLowerCase();
    return (
      (!search || inv.bloodGroup?.toLowerCase().includes(q) || inv.component?.toLowerCase().includes(q) || inv.cityName?.toLowerCase().includes(q)) &&
      (!filterGroup || inv.bloodGroup === filterGroup) &&
      (!filterComp || inv.component === filterComp) &&
      (!filterAlert || (filterAlert === 'critical' ? inv.isCriticalStock : inv.isLowStock))
    );
  });

  /* Summary stats derived from filtered inventory */
  const totalUnits      = filtered.reduce((a, i) => a + (i.totalUnits ?? 0), 0);
  const totalAvailable  = filtered.reduce((a, i) => a + (i.availableUnits ?? 0), 0);
  const totalReserved   = filtered.reduce((a, i) => a + (i.reservedUnits ?? 0), 0);
  const totalIssued     = filtered.reduce((a, i) => a + (i.issuedUnits ?? 0), 0);
  const totalExpired    = filtered.reduce((a, i) => a + (i.expiredUnits ?? 0), 0);
  const totalDiscarded  = filtered.reduce((a, i) => a + (i.discardedUnits ?? 0), 0);
  const totalQuarant    = filtered.reduce((a, i) => a + (i.quarantinedUnits ?? 0), 0);
  const criticalCount   = filtered.filter(i => i.isCriticalStock).length;
  const lowCount        = filtered.filter(i => i.isLowStock && !i.isCriticalStock).length;
  const expiring3d      = filtered.reduce((a, i) => a + (i.expiringIn3Days ?? 0), 0);
  const expiring7d      = filtered.reduce((a, i) => a + (i.expiringIn7Days ?? 0), 0);

  /* Radial chart data — availableUnits per blood group */
  const radialData = BLOOD_GROUPS.map(g => ({
    name: g,
    value: filtered.filter(i => i.bloodGroup === g).reduce((a, i) => a + (i.availableUnits ?? 0), 0),
    fill: GROUP_COLORS[g],
  })).filter(d => d.value > 0);

  const hasFilters = search || filterGroup || filterComp || filterAlert;

  return (
    <>
      <div className="flex flex-col gap-6">

        {/* ── Page header ── */}
        <motion.div initial={{ opacity: 0, y: -12 }} animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h1 className="font-montserrat font-black text-2xl md:text-3xl text-base-content">
              Blood Inventory
            </h1>
            <p className="text-sm text-base-content/50 mt-0.5">
              {filtered.length} slot{filtered.length !== 1 ? 's' : ''} ·&nbsp;
              {totalAvailable} available · {totalUnits} total
            </p>
            <NoteLabel text="One BloodInventory doc per (bloodBank + bloodGroup + component). Max 500 units per doc." />
          </div>
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: .96 }} onClick={() => dispatch(fetchMyInventory())}
              className="btn btn-ghost btn-sm gap-1.5">
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </motion.button>
            <motion.button whileTap={{ scale: .96 }} onClick={() => setShowCreate(true)}
              className="btn btn-primary btn-sm gap-1.5">
              <Plus className="w-3.5 h-3.5" />
              New Slot
            </motion.button>
          </div>
        </motion.div>

        {/* ── Stat pills — all 7 counter fields + alerts ── */}
        <motion.div variants={container} initial="hidden" animate="show"
          className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
          <StatPill label="Total"       value={totalUnits}      icon={Package}        color="var(--base-content)" note="totalUnits sum" />
          <StatPill label="Available"   value={totalAvailable}  icon={Droplets}       color="var(--success)"      note="availableUnits" />
          <StatPill label="Reserved"    value={totalReserved}   icon={Lock}           color="var(--warning)"      note="reservedUnits (atomic $inc)" />
          <StatPill label="Issued"      value={totalIssued}     icon={ArrowUpRight}   color="var(--info)"         note="issuedUnits" />
          <StatPill label="Expired"     value={totalExpired}    icon={Clock}          color="var(--error)"        note="expiredUnits" />
          <StatPill label="Discarded"   value={totalDiscarded}  icon={Trash2}         color="var(--error)"        note="discardedUnits" />
          <StatPill label="Quarantined" value={totalQuarant}    icon={ShieldAlert}    color="var(--warning)"      note="quarantinedUnits" />
          <StatPill label="Critical"    value={criticalCount}   icon={AlertTriangle}  color="var(--error)"        note="isCriticalStock slots" />
        </motion.div>

        {/* ── Expiry alert banner ── */}
        {expiring3d > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/30">
            <AlertTriangle className="w-5 h-5 text-error flex-shrink-0" />
            <div>
              <p className="text-sm font-bold text-error">
                {expiring3d} bag{expiring3d !== 1 ? 's' : ''} expiring within 3 days — {expiring7d} within 7 days
              </p>
              <NoteLabel text="expiringIn3Days / expiringIn7Days — recomputed by runExpiryCheck() daily job" />
            </div>
          </motion.div>
        )}

        {/* ── Chart + Filters row ── */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* Radial chart — availableUnits by bloodGroup */}
          <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .1 }}
            className="card p-5 lg:col-span-1">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40 mb-1">
              Available by Blood Group
            </p>
            <NoteLabel text="availableUnits grouped by bloodGroup across all components" />
            <div className="h-44 mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <RadialBarChart cx="50%" cy="50%" innerRadius="30%" outerRadius="90%"
                  data={radialData} startAngle={90} endAngle={-270}>
                  <RadialBar dataKey="value" cornerRadius={4} background={{ fill: 'var(--base-300)' }} />
                  <Tooltip contentStyle={{ background: 'var(--base-200)', border: '1px solid var(--base-300)', borderRadius: '12px', fontSize: 11 }}
                    formatter={(v, n) => [v + ' units', n]} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1.5 mt-2">
              {radialData.map(d => (
                <div key={d.name} className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full" style={{ background: d.fill }} />
                  <span className="text-[10px] text-base-content/60">{d.name} {d.value}</span>
                </div>
              ))}
            </div>
          </motion.div>

          {/* Filters */}
          <motion.div initial={{ opacity: 0, scale: .97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: .15 }}
            className="card p-5 lg:col-span-2 flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">Filters</p>

            {/* search — bloodGroup, component, cityName */}
            <div>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
                <input placeholder="Search blood group, component, city…"
                  className="input-field pl-9" value={search}
                  onChange={e => setSearch(e.target.value)} />
              </div>
              <NoteLabel text="Searches: bloodGroup, component, cityName fields" />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {/* bloodGroup filter */}
              <div>
                <label className="label mb-1"><span className="label-text">Blood Group</span></label>
                <select className="input-field" value={filterGroup} onChange={e => setFilterGroup(e.target.value)}>
                  <option value="">All Groups</option>
                  {BLOOD_GROUPS.map(g => <option key={g}>{g}</option>)}
                </select>
                <NoteLabel text="bloodGroup enum filter" />
              </div>

              {/* component filter */}
              <div>
                <label className="label mb-1"><span className="label-text">Component</span></label>
                <select className="input-field" value={filterComp} onChange={e => setFilterComp(e.target.value)}>
                  <option value="">All Components</option>
                  {COMPONENTS.map(c => <option key={c}>{c}</option>)}
                </select>
                <NoteLabel text="component enum filter" />
              </div>

              {/* alert state filter — isLowStock / isCriticalStock */}
              <div>
                <label className="label mb-1"><span className="label-text">Alert State</span></label>
                <select className="input-field" value={filterAlert} onChange={e => setFilterAlert(e.target.value)}>
                  <option value="">All Slots</option>
                  <option value="critical">Critical Only</option>
                  <option value="low">Low Stock</option>
                </select>
                <NoteLabel text="isCriticalStock / isLowStock boolean flags" />
              </div>
            </div>

            {hasFilters && (
              <button onClick={() => { setSearch(''); setFilterGroup(''); setFilterComp(''); setFilterAlert(''); }}
                className="btn btn-ghost btn-sm self-start gap-1.5 text-error">
                <X className="w-3.5 h-3.5" /> Clear filters
              </button>
            )}
          </motion.div>
        </div>

        {/* ── Summary row: low stock + expiry quick stats ── */}
        {(lowCount > 0 || criticalCount > 0) && (
          <div className="flex flex-wrap gap-2">
            {criticalCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-error/10 border border-error/20 text-xs">
                <ShieldAlert className="w-3.5 h-3.5 text-error" />
                <span className="font-bold text-error">{criticalCount} critical slot{criticalCount !== 1 ? 's' : ''}</span>
                <NoteLabel text="isCriticalStock" />
              </div>
            )}
            {lowCount > 0 && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-xs">
                <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                <span className="font-bold text-warning">{lowCount} low stock slot{lowCount !== 1 ? 's' : ''}</span>
                <NoteLabel text="isLowStock" />
              </div>
            )}
          </div>
        )}

        {/* ── Inventory grid ── */}
        {loading && !myInventory?.length ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array(8).fill(0).map((_, i) => (
              <div key={i} className="skeleton h-52 rounded-2xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 rounded-2xl bg-base-300/60 flex items-center justify-center mb-4">
              <Droplets className="w-7 h-7 text-base-content/30" />
            </div>
            <p className="font-semibold text-base-content/50">No inventory slots found</p>
            <p className="text-sm text-base-content/30 mt-1">
              {hasFilters ? 'Try adjusting your filters' : 'Create your first slot to get started'}
            </p>
            {!hasFilters && (
              <button onClick={() => setShowCreate(true)} className="btn btn-primary btn-sm mt-4 gap-1.5">
                <Plus className="w-3.5 h-3.5" /> Create Slot
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div variants={container} initial="hidden" animate="show"
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filtered.map(inv => (
              <InventoryCard key={inv._id} inv={inv} onClick={setSelected} />
            ))}
          </motion.div>
        )}
      </div>

      <CreateSlotModal open={showCreate} onClose={() => setShowCreate(false)} />
      <InventoryDetailDrawer inv={selected} onClose={() => setSelected(null)} />
    </>
  );
}