'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Phone, MapPin, Calendar, Droplets, AlertTriangle,
  Save, X, Camera, Heart, Shield, Activity, Clock, CheckCircle2,
  Loader2, Languages, Weight, Ruler, Gauge, Zap
} from 'lucide-react';
import {
  fetchMyProfile,
  updateMyUser,
  updateMyCustomerProfile,
  updateSnapshot,
  selectCustomerUser,
  selectCustomerProfile,
  selectSnapshot,
  selectProfileLoading,
  selectSectionLoading,
} from '@/store/slices/customerProfileSlice';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const BLOOD_GROUPS  = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-', 'Bombay Phenotype (hh)', 'Rh-null (Golden Blood)', 'Rare/Other'];
const GENDERS       = ['Male', 'Female', 'Transgender', 'Other', 'Prefer not to say'];
const WORK_STATUSES = ['office', 'remote', 'on-leave', 'meeting'];
const RELATIONS     = ['Spouse', 'Parent', 'Child', 'Sibling', 'Friend', 'Other'];

const fadeUp = { hidden: { opacity: 0, y: 24 }, visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.5, ease: [0.22, 1, 0.36, 1] } }) };
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

const THEME_MAP = {
  primary: { bg: 'bg-primary', text: 'text-primary', lightBg: 'bg-primary/10' },
  error:   { bg: 'bg-error',   text: 'text-error',   lightBg: 'bg-error/10' },
  warning: { bg: 'bg-warning', text: 'text-warning', lightBg: 'bg-warning/10' },
  success: { bg: 'bg-success', text: 'text-success', lightBg: 'bg-success/10' },
  info:    { bg: 'bg-info',    text: 'text-info',    lightBg: 'bg-info/10' },
};

// ─── Reusable Editable Field ──────────────────────────────────────────────────
const EditField = ({ label, value, onChange, type = 'text', options, icon: Icon, theme = 'primary' }) => {
  const iconColor = THEME_MAP[theme]?.text || 'text-primary';
  
  return (
    <div className="group relative">
      <label className="block text-xs font-bold uppercase tracking-widest mb-1.5 text-base-content/50">
        {label}
      </label>
      <div className="relative">
        {Icon && <Icon size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-70 ${iconColor}`} />}
        {options ? (
          <select value={value || ''} onChange={e => onChange(e.target.value)}
            className={`input-field w-full appearance-none ${Icon ? 'pl-10' : 'pl-4'}`}>
            <option value="">Select…</option>
            {options.map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        ) : (
          <input type={type} value={value || ''} onChange={e => onChange(e.target.value)}
            className={`input-field w-full ${Icon ? 'pl-10' : 'pl-4'}`} />
        )}
      </div>
    </div>
  );
};

// ─── Section Wrapper ──────────────────────────────────────────────────────────
const Section = ({ title, icon: Icon, children, theme = 'primary', delay = 0 }) => {
  const colors = THEME_MAP[theme] || THEME_MAP.primary;

  return (
    <motion.div variants={fadeUp} custom={delay} className="card p-6 relative overflow-hidden">
      <div className={`absolute top-0 left-0 w-1 h-full rounded-l-xl ${colors.bg}`} />
      <div className="flex items-center gap-2 mb-5">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.lightBg}`}>
          <Icon size={16} className={colors.text} />
        </div>
        <h3 className="font-black text-sm uppercase tracking-widest text-base-content">{title}</h3>
      </div>
      {children}
    </motion.div>
  );
};

// ─── Avatar Upload ────────────────────────────────────────────────────────────
const AvatarBlock = ({ user }) => {
  const initials = user?.name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || 'ME';
  
  return (
    <div className="relative w-24 h-24 mx-auto sm:mx-0 flex-shrink-0">
      {user?.avatar ? (
        <img src={user.avatar} alt={user.name} className="w-24 h-24 rounded-2xl object-cover ring-4 ring-primary" />
      ) : (
        <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-2xl font-black bg-primary text-primary-content">
          {initials}
        </div>
      )}
      <button className="absolute -bottom-2 -right-2 w-8 h-8 rounded-xl flex items-center justify-center shadow-lg transition-transform hover:scale-110 bg-primary text-primary-content">
        <Camera size={13} />
      </button>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function MyProfile() {
  const dispatch   = useDispatch();
  const user       = useSelector(selectCustomerUser);
  const profile    = useSelector(selectCustomerProfile);
  const snapshot   = useSelector(selectSnapshot);
  const loading    = useSelector(selectProfileLoading);
  const saving     = useSelector(selectSectionLoading('profile'));
  const snapSaving = useSelector(selectSectionLoading('snapshot'));

  // Local form state
  const [userForm,    setUserForm]    = useState({});
  const [profileForm, setProfileForm] = useState({});
  const [snapForm,    setSnapForm]    = useState({});
  const [activeTab,   setActiveTab]   = useState('basic');
  const [dirty,       setDirty]       = useState({ user: false, profile: false, snapshot: false });

  // Seed forms when data arrives
  useEffect(() => { dispatch(fetchMyProfile()); }, [dispatch]);

  useEffect(() => {
    if (user) setUserForm({
      name: user.name || '', phone: user.phone || '',
      workStatus: user.workStatus || 'office',
      lastKnownAddress: user.lastKnownAddress || '',
    });
  }, [user]);

  useEffect(() => {
    if (profile) setProfileForm({
      gender: profile.gender || '', dob: profile.dob ? profile.dob.slice(0, 10) : '',
      bloodGroup: profile.bloodGroup || '',
      emergencyContact: profile.emergencyContact || { name: '', phone: '', relation: '' },
    });
  }, [profile]);

  useEffect(() => {
    if (snapshot || profile?.snapshot) {
      const s = snapshot || profile?.snapshot || {};
      setSnapForm({
        chronicConditions: (s.chronicConditions || []).join(', '),
        allergies:         (s.allergies || []).join(', '),
        primaryLanguage:   s.primaryLanguage || 'English',
        vitals: {
          bloodPressure: s.vitals?.bloodPressure || '',
          sugarLevel:    s.vitals?.sugarLevel    || '',
          heightCm:      s.vitals?.heightCm      || '',
          weightKg:      s.vitals?.weightKg      || '',
        },
      });
    }
  }, [snapshot, profile]);

  const setU = (key, val) => { setUserForm(p => ({ ...p, [key]: val })); setDirty(d => ({ ...d, user: true })); };
  const setP = (key, val) => { setProfileForm(p => ({ ...p, [key]: val })); setDirty(d => ({ ...d, profile: true })); };
  const setEC = (key, val) => setP('emergencyContact', { ...profileForm.emergencyContact, [key]: val });
  const setV  = (key, val) => { setSnapForm(p => ({ ...p, vitals: { ...p.vitals, [key]: val } })); setDirty(d => ({ ...d, snapshot: true })); };
  const setSn = (key, val) => { setSnapForm(p => ({ ...p, [key]: val })); setDirty(d => ({ ...d, snapshot: true })); };

  const handleSaveUser = () => { dispatch(updateMyUser(userForm)); setDirty(d => ({ ...d, user: false })); };
  const handleSaveProfile = () => {
    dispatch(updateMyCustomerProfile({
      ...profileForm,
      dob: profileForm.dob || undefined,
    }));
    setDirty(d => ({ ...d, profile: false }));
  };
  const handleSaveSnapshot = () => {
    dispatch(updateSnapshot({
      chronicConditions: snapForm.chronicConditions.split(',').map(s => s.trim()).filter(Boolean),
      allergies:         snapForm.allergies.split(',').map(s => s.trim()).filter(Boolean),
      primaryLanguage:   snapForm.primaryLanguage,
      vitals:            snapForm.vitals,
    }));
    setDirty(d => ({ ...d, snapshot: false }));
  };

  const TABS = [
    { id: 'basic',     label: 'Basic Info',  icon: User },
    { id: 'health',    label: 'Health',      icon: Heart },
    { id: 'emergency', label: 'Emergency',   icon: AlertTriangle },
    { id: 'vitals',    label: 'Vitals',      icon: Activity },
  ];

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="flex flex-col items-center gap-4">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center animate-pulse bg-primary">
          <Loader2 size={24} className="animate-spin text-primary-content" />
        </div>
        <p className="text-sm font-bold uppercase tracking-widest text-base-content/50">Loading profile…</p>
      </div>
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6 container-custom">

      {/* ── Header Card ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp}
        className="glass-card p-6 flex flex-col sm:flex-row items-center gap-6">
        <AvatarBlock user={user} />
        <div className="flex-1 text-center sm:text-left">
          <h1 className="text-2xl font-black tracking-tight text-base-content">
            {user?.name || 'My Profile'}
          </h1>
          <p className="text-sm mt-1 text-base-content/60">{user?.email}</p>
          <div className="flex flex-wrap gap-2 mt-3 justify-center sm:justify-start">
            <span className="badge badge-primary capitalize">{user?.role || 'customer'}</span>
            {user?.isEmailVerified && <span className="badge badge-success">Email Verified</span>}
            {user?.isPhoneVerified && <span className="badge badge-success">Phone Verified</span>}
            {user?.workStatus && <span className="badge badge-info capitalize">{user.workStatus}</span>}
          </div>
        </div>
        <div className="text-center sm:text-right mt-4 sm:mt-0 border-t sm:border-t-0 sm:border-l border-base-300 pt-4 sm:pt-0 sm:pl-6">
          <p className="text-xs uppercase tracking-widest font-bold mb-1 text-base-content/40">Member since</p>
          <p className="text-sm font-bold text-primary">
            {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—'}
          </p>
        </div>
      </motion.div>

      {/* ── Tabs ── */}
      <motion.div initial="hidden" animate="visible" variants={fadeUp} custom={1}
        className="flex gap-1 p-1 rounded-xl bg-base-200 overflow-x-auto scrollbar-thin">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-[100px] flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-content shadow-primary'
                : 'text-base-content/60 hover:text-base-content hover:bg-base-300/60'
            }`}>
            <tab.icon size={13} />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </motion.div>

      {/* ── Tab Panels ── */}
      <AnimatePresence mode="wait">

        {/* BASIC INFO */}
        {activeTab === 'basic' && (
          <motion.div key="basic" initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={stagger} className="space-y-4">
            <Section title="Personal Details" icon={User} delay={0} theme="primary">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <EditField label="Full Name"   icon={User}   value={userForm.name}             onChange={v => setU('name', v)} theme="primary" />
                <EditField label="Phone"       icon={Phone}  value={userForm.phone}            onChange={v => setU('phone', v)} theme="primary" />
                <EditField label="Work Status" icon={Clock}  value={userForm.workStatus}       onChange={v => setU('workStatus', v)} options={WORK_STATUSES} theme="primary" />
                <EditField label="Address"     icon={MapPin} value={userForm.lastKnownAddress} onChange={v => setU('lastKnownAddress', v)} theme="primary" />
              </div>
              <AnimatePresence>
                {dirty.user && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="flex justify-end gap-3 mt-5 pt-5 border-t border-base-300">
                    <button onClick={() => { setDirty(d => ({ ...d, user: false })); dispatch(fetchMyProfile()); }}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-70 bg-base-200 text-base-content">
                      <X size={14} /> Discard
                    </button>
                    <button onClick={handleSaveUser} disabled={saving}
                      className="btn-primary-cta flex items-center gap-2 py-2 px-5 text-xs">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save Changes
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>
          </motion.div>
        )}

        {/* HEALTH */}
        {activeTab === 'health' && (
          <motion.div key="health" initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={stagger} className="space-y-4">
            <Section title="Health Details" icon={Heart} theme="error" delay={0}>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <EditField label="Gender"        icon={User}     value={profileForm.gender}     onChange={v => setP('gender', v)}     options={GENDERS} theme="error" />
                <EditField label="Date of Birth" icon={Calendar} value={profileForm.dob}        onChange={v => setP('dob', v)}        type="date" theme="error" />
                <EditField label="Blood Group"   icon={Droplets} value={profileForm.bloodGroup} onChange={v => setP('bloodGroup', v)} options={BLOOD_GROUPS} theme="error" />
              </div>
              <AnimatePresence>
                {dirty.profile && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="flex justify-end gap-3 mt-5 pt-5 border-t border-base-300">
                    <button onClick={() => setDirty(d => ({ ...d, profile: false }))}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all hover:opacity-70 bg-base-200 text-base-content">
                      <X size={14} /> Discard
                    </button>
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="btn-primary-cta flex items-center gap-2 py-2 px-5 text-xs">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>
          </motion.div>
        )}

        {/* EMERGENCY */}
        {activeTab === 'emergency' && (
          <motion.div key="emergency" initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={stagger} className="space-y-4">
            <Section title="Emergency Contact" icon={AlertTriangle} theme="warning" delay={0}>
              <div className="p-4 rounded-xl mb-6 bg-warning/10 border border-warning/30">
                <p className="text-xs font-bold text-warning flex items-center gap-2">
                  <AlertTriangle size={14} /> This contact will be notified in medical emergencies.
                </p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <EditField label="Name"     icon={User}  value={profileForm.emergencyContact?.name}     onChange={v => setEC('name', v)} theme="warning" />
                <EditField label="Phone"    icon={Phone} value={profileForm.emergencyContact?.phone}    onChange={v => setEC('phone', v)} theme="warning" />
                <EditField label="Relation" icon={Heart} value={profileForm.emergencyContact?.relation} onChange={v => setEC('relation', v)} options={RELATIONS} theme="warning" />
              </div>
              <AnimatePresence>
                {dirty.profile && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="flex justify-end mt-5 pt-5 border-t border-base-300">
                    <button onClick={handleSaveProfile} disabled={saving}
                      className="btn-primary-cta flex items-center gap-2 py-2 px-5 text-xs">
                      {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
                      Save
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>
          </motion.div>
        )}

        {/* VITALS & SNAPSHOT */}
        {activeTab === 'vitals' && (
          <motion.div key="vitals" initial="hidden" animate="visible" exit={{ opacity: 0 }} variants={stagger} className="space-y-4">
            
            {/* Vitals Grid */}
            <Section title="Health Vitals" icon={Activity} theme="success" delay={0}>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                {[
                  { key: 'bloodPressure', label: 'Blood Pressure', icon: Gauge,    placeholder: '120/80 mmHg' },
                  { key: 'sugarLevel',    label: 'Sugar Level',    icon: Zap,      placeholder: '90 mg/dL' },
                  { key: 'heightCm',      label: 'Height',         icon: Ruler,    placeholder: 'cm', type: 'number' },
                  { key: 'weightKg',      label: 'Weight',         icon: Weight,   placeholder: 'kg', type: 'number' },
                ].map(({ key, label, icon: Icon, placeholder, type }) => (
                  <div key={key} className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-widest text-base-content/50">{label}</label>
                    <div className="relative group">
                      <Icon size={13} className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none text-success opacity-80" />
                      <input type={type || 'text'} placeholder={placeholder}
                        value={snapForm.vitals?.[key] || ''}
                        onChange={e => setV(key, e.target.value)}
                        className="input-field w-full text-sm pl-9" />
                    </div>
                  </div>
                ))}
              </div>
              {snapForm.vitals?.lastUpdated && (
                <p className="text-xs flex items-center gap-1 text-base-content/50 mt-4 border-t border-base-300 pt-4">
                  <Clock size={11} /> Last updated: {new Date(snapForm.vitals.lastUpdated).toLocaleDateString('en-IN')}
                </p>
              )}
            </Section>

            {/* Conditions & Allergies */}
            <Section title="Conditions & Allergies" icon={Shield} theme="info" delay={1}>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="block text-xs font-bold uppercase tracking-widest text-base-content/50">Chronic Conditions</label>
                  <input placeholder="Diabetes, Hypertension (comma-separated)"
                    value={snapForm.chronicConditions || ''}
                    onChange={e => setSn('chronicConditions', e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="block text-xs font-bold uppercase tracking-widest text-base-content/50">Allergies</label>
                  <input placeholder="Penicillin, Peanuts (comma-separated)"
                    value={snapForm.allergies || ''}
                    onChange={e => setSn('allergies', e.target.value)}
                    className="input-field w-full text-sm" />
                </div>
                <div className="sm:col-span-2 md:col-span-1">
                  <EditField label="Primary Language" icon={Languages}
                    value={snapForm.primaryLanguage}
                    onChange={v => setSn('primaryLanguage', v)}
                    options={['English', 'Telugu', 'Hindi', 'Tamil', 'Kannada', 'Malayalam', 'Bengali', 'Marathi']}
                    theme="info" />
                </div>
              </div>
              
              <AnimatePresence>
                {dirty.snapshot && (
                  <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                    className="flex justify-end mt-5 pt-5 border-t border-base-300">
                    <button onClick={handleSaveSnapshot} disabled={snapSaving}
                      className="btn-success-cta flex items-center gap-2 py-2 px-5 text-xs">
                      {snapSaving ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
                      Save Snapshot
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </Section>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}