'use client';

import { useState, useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, Mail, Phone, Camera, Save, Edit3, X, Check,
  Eye, EyeOff, KeyRound, Trash2, AlertTriangle, Loader2,
  MapPin, Globe, Shield, ChevronRight, BadgeCheck,
} from 'lucide-react';
import {
  selectUser, selectProfile, selectLoaders, selectError,
  getProfile, updateProfile, changePassword, deleteAccount,
  requestEmailChange, confirmEmailChange,
  verifyPhone, confirmPhoneVerification,
  clearError,
} from '@/store/slices/userSlice';

// ── Animation variants ────────────────────────────────────────────────────────
const fadeUp = {
  hidden:  { opacity: 0, y: 24 },
  visible: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const slideIn = {
  hidden:  { opacity: 0, x: -16 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, x: 16,  transition: { duration: 0.25 } },
};

// ── Reusable input component ──────────────────────────────────────────────────
function Field({ label, icon: Icon, error, children, required }) {
  return (
    <div className="space-y-1.5">
      <label className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
        {Icon && <Icon size={13} style={{ color: 'var(--primary)' }} />}
        {label}
        {required && <span style={{ color: 'var(--error)' }}>*</span>}
      </label>
      {children}
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="text-xs font-medium flex items-center gap-1"
            style={{ color: 'var(--error)' }}
          >
            <AlertTriangle size={11} /> {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function Input({ className = '', ...props }) {
  return (
    <input
      className={`input-field w-full ${className}`}
      {...props}
    />
  );
}

// ── OTP Input strip ───────────────────────────────────────────────────────────
function OtpInput({ value, onChange, length = 6 }) {
  const refs = useRef([]);
  const digits = value.split('').concat(Array(length).fill('')).slice(0, length);

  const handle = (i, e) => {
    const d = e.target.value.replace(/\D/, '').slice(-1);
    const next = [...digits]; next[i] = d;
    onChange(next.join(''));
    if (d && i < length - 1) refs.current[i + 1]?.focus();
  };

  const handleKey = (i, e) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) refs.current[i - 1]?.focus();
  };

  return (
    <div className="flex gap-2">
      {digits.map((d, i) => (
        <input
          key={i} ref={el => refs.current[i] = el}
          value={d} maxLength={1} inputMode="numeric"
          onChange={e => handle(i, e)} onKeyDown={e => handleKey(i, e)}
          className="w-10 h-12 text-center text-lg font-bold rounded-lg outline-none transition-all duration-200"
          style={{
            background: 'var(--base-200)',
            border: `2px solid ${d ? 'var(--primary)' : 'var(--base-300)'}`,
            color: 'var(--base-content)',
            boxShadow: d ? '0 0 0 3px color-mix(in srgb, var(--primary), transparent 80%)' : 'none',
          }}
        />
      ))}
    </div>
  );
}

// ── Avatar section ────────────────────────────────────────────────────────────
function AvatarSection({ user, onAvatarChange }) {
  const [hov, setHov] = useState(false);
  return (
    <div className="flex items-center gap-5">
      <div
        className="relative cursor-pointer"
        onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
        onClick={onAvatarChange}
      >
        <div className="w-20 h-20 rounded-2xl overflow-hidden" style={{ border: '3px solid var(--primary)' }}>
          {user?.avatar
            ? <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            : (
              <div className="w-full h-full flex items-center justify-center text-2xl font-black"
                style={{ background: 'var(--bg-gradient-primary)', color: 'var(--primary-content)' }}>
                {user?.name?.[0]?.toUpperCase() ?? 'U'}
              </div>
            )}
        </div>
        <AnimatePresence>
          {hov && (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--neutral), transparent 30%)' }}
            >
              <Camera size={20} color="white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
      <div>
        <p className="font-black text-lg font-montserrat" style={{ color: 'var(--base-content)' }}>{user?.name}</p>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 40%)' }}>{user?.email}</p>
        <div className="flex items-center gap-2 mt-1">
          <span className="badge badge-primary capitalize">{user?.role}</span>
          {user?.isEmailVerified && <BadgeCheck size={14} style={{ color: 'var(--success)' }} />}
        </div>
      </div>
    </div>
  );
}

// ── Modal wrapper ─────────────────────────────────────────────────────────────
function Modal({ open, onClose, title, children }) {
  useEffect(() => {
    const esc = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', esc);
    return () => document.removeEventListener('keydown', esc);
  }, [onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'color-mix(in srgb, var(--neutral), transparent 40%)' }}
          onClick={(e) => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 20 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="w-full max-w-md glass-card p-6 space-y-5"
          >
            <div className="flex items-center justify-between">
              <h3 className="font-black text-xl font-montserrat" style={{ color: 'var(--base-content)' }}>{title}</h3>
              <button onClick={onClose} className="p-1.5 rounded-lg transition-colors hover:bg-base-200">
                <X size={18} style={{ color: 'var(--base-content)' }} />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AccountSettings() {
  const dispatch = useDispatch();
  const user     = useSelector(selectUser);
  const profile  = useSelector(selectProfile);
  const loaders  = useSelector(selectLoaders);
  const error    = useSelector(selectError);

  // Profile form
  const [form, setForm] = useState({ name: '', phone: '', avatar: '' });
  const [editing, setEditing] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  // Password change
  const [showPwModal, setShowPwModal] = useState(false);
  const [pw, setPw] = useState({ old: '', newPw: '', confirm: '' });
  const [showPw, setShowPw] = useState({ old: false, newPw: false, confirm: false });
  const [pwErrors, setPwErrors] = useState({});

  // Email change
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailStep, setEmailStep] = useState(1); // 1=input, 2=otp
  const [newEmail, setNewEmail] = useState('');
  const [emailOtp, setEmailOtp] = useState('');
  const [emailErr, setEmailErr] = useState('');

  // Phone verify
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [phoneStep, setPhoneStep] = useState(1);
  const [phoneOtp, setPhoneOtp] = useState('');

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deletePw, setDeletePw] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');

  // Hydrate form
  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  useEffect(() => {
    if (user) setForm({ name: user.name ?? '', phone: user.phone ?? '', avatar: user.avatar ?? '' });
  }, [user]);

  // ── Profile save ─────────────────────────────────────────────────────────
  const validateProfile = () => {
    const errs = {};
    if (!form.name.trim()) errs.name = 'Name is required';
    if (form.avatar && !/^https?:\/\/.+/.test(form.avatar)) errs.avatar = 'Must be a valid URL';
    setFormErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleSaveProfile = async () => {
    if (!validateProfile()) return;
    const res = await dispatch(updateProfile(form));
    if (!res.error) setEditing(false);
  };

  // ── Password change ────────────────────────────────────────────────────────
  const validatePw = () => {
    const errs = {};
    if (!pw.old) errs.old = 'Required';
    if (pw.newPw.length < 8) errs.newPw = 'Minimum 8 characters';
    if (pw.newPw !== pw.confirm) errs.confirm = 'Passwords do not match';
    setPwErrors(errs);
    return !Object.keys(errs).length;
  };

  const handleChangePw = async () => {
    if (!validatePw()) return;
    const res = await dispatch(changePassword({ oldPassword: pw.old, newPassword: pw.newPw }));
    if (!res.error) { setShowPwModal(false); setPw({ old: '', newPw: '', confirm: '' }); }
  };

  // ── Email change ──────────────────────────────────────────────────────────
  const handleRequestEmailChange = async () => {
    if (!newEmail || !/\S+@\S+\.\S+/.test(newEmail)) { setEmailErr('Valid email required'); return; }
    const res = await dispatch(requestEmailChange(newEmail));
    if (!res.error) setEmailStep(2);
  };

  const handleConfirmEmailChange = async () => {
    if (emailOtp.length < 6) { setEmailErr('Enter 6-digit OTP'); return; }
    const res = await dispatch(confirmEmailChange(emailOtp));
    if (!res.error) { setShowEmailModal(false); setEmailStep(1); setEmailOtp(''); setNewEmail(''); }
  };

  // ── Phone verify ──────────────────────────────────────────────────────────
  const handleSendPhoneOtp = async () => {
    const res = await dispatch(verifyPhone());
    if (!res.error) setPhoneStep(2);
  };

  const handleConfirmPhoneOtp = async () => {
    if (phoneOtp.length < 6) return;
    const res = await dispatch(confirmPhoneVerification(phoneOtp));
    if (!res.error) { setShowPhoneModal(false); setPhoneStep(1); setPhoneOtp(''); }
  };

  // ── Delete account ────────────────────────────────────────────────────────
  const handleDeleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    await dispatch(deleteAccount());
  };

  const togglePwVis = (k) => setShowPw(p => ({ ...p, [k]: !p[k] }));

  return (
    <div className="space-y-6 animate-fade-in">

      {/* Header */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={0}>
        <h2 className="section-heading text-3xl md:text-4xl">Account Settings</h2>
        <p className="section-subheading text-base">Manage your identity, credentials, and account lifecycle.</p>
      </motion.div>

      {/* Global error */}
      <AnimatePresence>
        {error && (
          <motion.div variants={slideIn} initial="hidden" animate="visible" exit="exit"
            className="alert alert-error flex items-center justify-between">
            <span className="text-sm font-medium">{error}</span>
            <button onClick={() => dispatch(clearError())}><X size={16} /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Profile card ─────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={1} className="glass-card p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
              <User size={16} style={{ color: 'var(--primary)' }} />
            </div>
            <h3 className="font-black text-lg font-montserrat">Personal Information</h3>
          </div>
          {!editing ? (
            <button onClick={() => setEditing(true)}
              className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5">
              <Edit3 size={13} /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button onClick={() => { setEditing(false); setFormErrors({}); }}
                className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5">
                <X size={13} /> Cancel
              </button>
              <button onClick={handleSaveProfile} disabled={loaders.updateProfile}
                className="btn-primary-cta px-4 py-2 text-xs flex items-center gap-1.5">
                {loaders.updateProfile ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                Save
              </button>
            </div>
          )}
        </div>

        <AvatarSection user={user} onAvatarChange={() => editing && null} />

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Field label="Full Name" icon={User} error={formErrors.name} required>
            <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              disabled={!editing} placeholder="Your full name" />
          </Field>

          <Field label="Phone Number" icon={Phone}>
            <div className="relative">
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                disabled={!editing} placeholder="+91 XXXXX XXXXX" />
              {!user?.isPhoneVerified && user?.phone && (
                <button onClick={() => setShowPhoneModal(true)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold px-2 py-0.5 rounded-md"
                  style={{ background: 'color-mix(in srgb, var(--warning), transparent 80%)', color: 'var(--warning)' }}>
                  Verify
                </button>
              )}
              {user?.isPhoneVerified && (
                <BadgeCheck size={16} className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--success)' }} />
              )}
            </div>
          </Field>

          <Field label="Email Address" icon={Mail}>
            <div className="relative">
              <Input value={user?.email ?? ''} disabled placeholder="your@email.com" />
              {user?.isEmailVerified && (
                <BadgeCheck size={16} className="absolute right-3 top-1/2 -translate-y-1/2"
                  style={{ color: 'var(--success)' }} />
              )}
            </div>
            <button onClick={() => setShowEmailModal(true)}
              className="text-xs font-semibold flex items-center gap-1 mt-1 transition-colors"
              style={{ color: 'var(--primary)' }}>
              Change email <ChevronRight size={12} />
            </button>
          </Field>

          <Field label="Avatar URL" icon={Globe} error={formErrors.avatar}>
            <Input value={form.avatar} onChange={e => setForm(p => ({ ...p, avatar: e.target.value }))}
              disabled={!editing} placeholder="https://..." />
          </Field>
        </div>

        {/* Role + Member since */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 pt-2 border-t" style={{ borderColor: 'var(--base-300)' }}>
          {[
            { label: 'Role',         value: user?.role,       icon: Shield },
            { label: 'Member Since', value: user?.createdAt ? new Date(user.createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) : '—', icon: BadgeCheck },
            { label: 'Login Count',  value: user?.loginCount ?? 0, icon: Globe },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="space-y-0.5">
              <p className="text-xs font-semibold flex items-center gap-1"
                style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                <Icon size={11} /> {label}
              </p>
              <p className="text-sm font-bold capitalize" style={{ color: 'var(--base-content)' }}>{value}</p>
            </div>
          ))}
        </div>
      </motion.div>

      {/* ── Password card ─────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={2} className="glass-card p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--warning), transparent 85%)' }}>
              <KeyRound size={16} style={{ color: 'var(--warning)' }} />
            </div>
            <div>
              <h3 className="font-black text-lg font-montserrat">Password</h3>
              <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 45%)' }}>
                {user?.passwordChangedAt
                  ? `Last changed ${new Date(user.passwordChangedAt).toLocaleDateString('en-IN')}`
                  : 'Never changed'}
              </p>
            </div>
          </div>
          <button onClick={() => setShowPwModal(true)} className="btn-secondary px-4 py-2 text-xs flex items-center gap-1.5">
            <Edit3 size={13} /> Change
          </button>
        </div>
      </motion.div>

      {/* ── Danger zone ──────────────────────────────────────────────────── */}
      <motion.div variants={fadeUp} initial="hidden" animate="visible" custom={3}
        className="p-6 rounded-2xl space-y-4"
        style={{ background: 'color-mix(in srgb, var(--error), transparent 93%)', border: '1px solid color-mix(in srgb, var(--error), transparent 75%)' }}>
        <div className="flex items-center gap-2">
          <AlertTriangle size={18} style={{ color: 'var(--error)' }} />
          <h3 className="font-black text-lg font-montserrat" style={{ color: 'var(--error)' }}>Danger Zone</h3>
        </div>
        <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 30%)' }}>
          Once you delete your account, all your data will be permanently removed and cannot be recovered.
        </p>
        <button onClick={() => setShowDeleteModal(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all"
          style={{ background: 'var(--error)', color: 'var(--error-content)' }}>
          <Trash2 size={15} /> Delete Account Permanently
        </button>
      </motion.div>

      {/* ══ MODALS ══════════════════════════════════════════════════════════ */}

      {/* Change Password */}
      <Modal open={showPwModal} onClose={() => { setShowPwModal(false); setPwErrors({}); setPw({ old: '', newPw: '', confirm: '' }); }} title="Change Password">
        <div className="space-y-4">
          {[
            { key: 'old',     label: 'Current Password', placeholder: 'Enter current password' },
            { key: 'newPw',   label: 'New Password',     placeholder: 'Min 8 characters' },
            { key: 'confirm', label: 'Confirm Password', placeholder: 'Repeat new password' },
          ].map(({ key, label, placeholder }) => (
            <Field key={key} label={label} error={pwErrors[key]}>
              <div className="relative">
                <Input type={showPw[key] ? 'text' : 'password'} value={pw[key]}
                  onChange={e => setPw(p => ({ ...p, [key]: e.target.value }))}
                  placeholder={placeholder} className="pr-10" />
                <button type="button" onClick={() => togglePwVis(key)}
                  className="absolute right-3 top-1/2 -translate-y-1/2">
                  {showPw[key] ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </Field>
          ))}
          <button onClick={handleChangePw} disabled={loaders.changePassword}
            className="btn-primary-cta w-full flex items-center justify-center gap-2">
            {loaders.changePassword ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
            Update Password
          </button>
        </div>
      </Modal>

      {/* Change Email */}
      <Modal open={showEmailModal} onClose={() => { setShowEmailModal(false); setEmailStep(1); setEmailOtp(''); setEmailErr(''); }}
        title={emailStep === 1 ? 'Change Email Address' : 'Verify Change'}>
        <AnimatePresence mode="wait">
          {emailStep === 1 ? (
            <motion.div key="step1" variants={slideIn} initial="hidden" animate="visible" exit="exit" className="space-y-4">
              <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 35%)' }}>
                We'll send a verification code to your <strong>current</strong> email to confirm this change.
              </p>
              <Field label="New Email Address" icon={Mail} error={emailErr}>
                <Input type="email" value={newEmail} onChange={e => { setNewEmail(e.target.value); setEmailErr(''); }}
                  placeholder="new@email.com" />
              </Field>
              <button onClick={handleRequestEmailChange} disabled={loaders.requestEmailChange}
                className="btn-primary-cta w-full flex items-center justify-center gap-2">
                {loaders.requestEmailChange ? <Loader2 size={15} className="animate-spin" /> : <Mail size={15} />}
                Send Verification Code
              </button>
            </motion.div>
          ) : (
            <motion.div key="step2" variants={slideIn} initial="hidden" animate="visible" exit="exit" className="space-y-5">
              <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 35%)' }}>
                Enter the 6-digit code sent to <strong>{user?.email}</strong>.
              </p>
              <OtpInput value={emailOtp} onChange={setEmailOtp} />
              {emailErr && <p className="text-xs font-medium" style={{ color: 'var(--error)' }}>{emailErr}</p>}
              <button onClick={handleConfirmEmailChange} disabled={loaders.confirmEmailChange || emailOtp.length < 6}
                className="btn-primary-cta w-full flex items-center justify-center gap-2">
                {loaders.confirmEmailChange ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Confirm Change
              </button>
              <button onClick={() => setEmailStep(1)} className="w-full text-sm font-semibold text-center"
                style={{ color: 'var(--primary)' }}>← Back</button>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Verify Phone */}
      <Modal open={showPhoneModal} onClose={() => { setShowPhoneModal(false); setPhoneStep(1); setPhoneOtp(''); }}
        title={phoneStep === 1 ? 'Verify Phone Number' : 'Enter OTP'}>
        <AnimatePresence mode="wait">
          {phoneStep === 1 ? (
            <motion.div key="step1" variants={slideIn} initial="hidden" animate="visible" exit="exit" className="space-y-4">
              <p className="text-sm" style={{ color: 'color-mix(in srgb, var(--base-content), transparent 35%)' }}>
                We'll send a 6-digit OTP to <strong>{user?.phone}</strong> to verify ownership.
              </p>
              <button onClick={handleSendPhoneOtp} disabled={loaders.verifyPhone}
                className="btn-primary-cta w-full flex items-center justify-center gap-2">
                {loaders.verifyPhone ? <Loader2 size={15} className="animate-spin" /> : <Phone size={15} />}
                Send OTP
              </button>
            </motion.div>
          ) : (
            <motion.div key="step2" variants={slideIn} initial="hidden" animate="visible" exit="exit" className="space-y-5">
              <OtpInput value={phoneOtp} onChange={setPhoneOtp} />
              <button onClick={handleConfirmPhoneOtp} disabled={loaders.verifyPhoneConfirm || phoneOtp.length < 6}
                className="btn-primary-cta w-full flex items-center justify-center gap-2">
                {loaders.verifyPhoneConfirm ? <Loader2 size={15} className="animate-spin" /> : <Check size={15} />}
                Verify Phone
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </Modal>

      {/* Delete Account */}
      <Modal open={showDeleteModal} onClose={() => { setShowDeleteModal(false); setDeletePw(''); setDeleteConfirm(''); }}
        title="Delete Account">
        <div className="space-y-4">
          <div className="alert alert-error">
            <AlertTriangle size={16} style={{ color: 'var(--error)', flexShrink: 0 }} />
            <p className="text-sm font-medium">This action is <strong>irreversible</strong>. All your data, wallet balance, and history will be permanently deleted.</p>
          </div>
          <Field label="Your Password">
            <Input type="password" value={deletePw} onChange={e => setDeletePw(e.target.value)}
              placeholder="Confirm your password" />
          </Field>
          <Field label={`Type "DELETE" to confirm`}>
            <Input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE" className="font-mono" />
          </Field>
          <button
            onClick={handleDeleteAccount}
            disabled={loaders.deleteAccount || deleteConfirm !== 'DELETE' || !deletePw}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-lg text-sm font-bold transition-all disabled:opacity-40"
            style={{ background: 'var(--error)', color: 'var(--error-content)' }}>
            {loaders.deleteAccount ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Permanently Delete My Account
          </button>
        </div>
      </Modal>

    </div>
  );
}