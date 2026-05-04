'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Building2,
  CreditCard,
  Landmark,
  Hash,
  User,
  Smartphone,
  CheckCircle2,
  Clock,
  AlertCircle,
  Shield,
  Lock,
  Save,
  RefreshCw,
  ChevronRight,
  Info,
  BadgeCheck,
  Wallet,
  PiggyBank,
} from 'lucide-react';
import {
  fetchDriverMe,
  updateDriverBank,
} from '@/store/slices/transportPartnerSlice';

// ─── tiny helpers ────────────────────────────────────────────────────────────

const FieldNote = ({ children }) => (
  <p className="text-xs mt-1" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
    {children}
  </p>
);

const FieldLabel = ({ icon: Icon, label, required }) => (
  <label className="label mb-1">
    <span className="label-text flex items-center gap-1.5">
      {Icon && <Icon size={13} style={{ color: 'var(--primary)' }} />}
      {label}
      {required && <span style={{ color: 'var(--error)' }} className="text-xs">*</span>}
    </span>
  </label>
);

const SectionCard = ({ title, subtitle, icon: Icon, children, delay = 0 }) => (
  <motion.div
    initial={{ opacity: 0, y: 24 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: 0.45, delay, ease: [0.22, 1, 0.36, 1] }}
    className="card p-6 mb-5"
  >
    <div className="flex items-center gap-3 mb-5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'color-mix(in srgb, var(--primary), transparent 88%)', color: 'var(--primary)' }}
      >
        <Icon size={17} />
      </div>
      <div>
        <h3 className="font-montserrat text-base font-bold" style={{ color: 'var(--base-content)' }}>
          {title}
        </h3>
        {subtitle && (
          <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            {subtitle}
          </p>
        )}
      </div>
    </div>
    {children}
  </motion.div>
);

const StatusPill = ({ verified }) =>
  verified ? (
    <span className="badge badge-success flex items-center gap-1">
      <BadgeCheck size={11} /> Verified
    </span>
  ) : (
    <span className="badge badge-warning flex items-center gap-1">
      <Clock size={11} /> Pending Verification
    </span>
  );

const InfoBanner = ({ children }) => (
  <div
    className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 text-sm"
    style={{
      background: 'color-mix(in srgb, var(--info), transparent 90%)',
      border: '1px solid color-mix(in srgb, var(--info), transparent 70%)',
      color: 'var(--base-content)',
    }}
  >
    <Info size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--info)' }} />
    <span style={{ color: 'color-mix(in oklch, var(--base-content) 75%, transparent)' }}>{children}</span>
  </div>
);

// ─── main page ───────────────────────────────────────────────────────────────

export default function BankDetailsPage() {
  const dispatch = useDispatch();
  const router = useRouter();
  const { driverMe, loading } = useSelector((s) => s.transportPartner);

  const [form, setForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
  });

  const [ifscMeta, setIfscMeta] = useState(null); // branch lookup
  const [ifscLoading, setIfscLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState({});

  // load driver profile
  useEffect(() => {
    if (!driverMe) dispatch(fetchDriverMe());
  }, [dispatch, driverMe]);

  // sync form once driverMe loaded
  useEffect(() => {
    if (driverMe?.bankDetails) {
      const b = driverMe.bankDetails;
      setForm({
        accountHolderName: b.accountHolderName || '',
        accountNumber: '',        // never pre-fill full account no — security
        ifscCode: b.ifscCode || '',
        bankName: b.bankName || '',
        upiId: b.upiId || '',
      });
    }
  }, [driverMe]);

  const maskAccount = (last4) => (last4 ? `•••• •••• •••• ${last4}` : '—');

  // ── IFSC auto-lookup (razorpay public API) ────────────────────────────────
  const lookupIFSC = async (code) => {
    if (code.length !== 11) return;
    setIfscLoading(true);
    try {
      const res = await fetch(`https://ifsc.razorpay.com/${code.toUpperCase()}`);
      if (res.ok) {
        const data = await res.json();
        setIfscMeta(data);
        setForm((prev) => ({ ...prev, bankName: data.BANK || prev.bankName }));
      } else {
        setIfscMeta(null);
      }
    } catch {
      setIfscMeta(null);
    } finally {
      setIfscLoading(false);
    }
  };

  // ── validation ────────────────────────────────────────────────────────────
  const validate = () => {
    const e = {};
    if (!form.accountHolderName.trim()) e.accountHolderName = 'Name required';
    if (!form.accountNumber.trim()) e.accountNumber = 'Account number required';
    else if (!/^\d{9,18}$/.test(form.accountNumber)) e.accountNumber = 'Must be 9–18 digits';
    if (!form.ifscCode.trim()) e.ifscCode = 'IFSC required';
    else if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.ifscCode.toUpperCase())) e.ifscCode = 'Invalid IFSC format';
    if (form.upiId && !/^[\w.\-+]+@[\w.-]+$/.test(form.upiId)) e.upiId = 'Invalid UPI ID';
    return e;
  };

  const handleChange = (field, value) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors((prev) => ({ ...prev, [field]: undefined }));
    if (field === 'ifscCode' && value.length === 11) lookupIFSC(value);
    if (field === 'ifscCode' && value.length !== 11) setIfscMeta(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const payload = {
      accountHolderName: form.accountHolderName.trim(),
      accountNumber: form.accountNumber.trim(),
      ifscCode: form.ifscCode.toUpperCase().trim(),
      bankName: form.bankName.trim(),
      upiId: form.upiId.trim(),
    };

    const result = await dispatch(updateDriverBank(payload));
    if (!result.error) {
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
      dispatch(fetchDriverMe());
    }
  };

  const bank = driverMe?.bankDetails;

  // ── loading skeleton ──────────────────────────────────────────────────────
  if (loading && !driverMe) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--base-100)' }}>
        <div className="flex flex-col items-center gap-3">
          <div className="loading loading-spinner loading-lg" style={{ borderTopColor: 'var(--primary)' }} />
          <p className="text-sm font-medium" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
            Loading bank details…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>

      {/* ── Top Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="sticky top-0 z-30"
        style={{
          background: 'color-mix(in srgb, var(--base-100) 85%, transparent)',
          backdropFilter: 'blur(18px) saturate(160%)',
          borderBottom: '1px solid color-mix(in srgb, var(--base-300), transparent 30%)',
        }}
      >
        <div className="container-custom max-w-3xl mx-auto flex items-center gap-4 py-4">
          <button
            onClick={() => router.back()}
            className="btn btn-ghost btn-sm btn-circle"
            aria-label="Go back"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex-1 min-w-0">
            <h1 className="font-montserrat text-lg font-black truncate" style={{ color: 'var(--base-content)' }}>
              Bank Details
            </h1>
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
              Earnings &amp; settlement information
            </p>
          </div>

          <div className="flex items-center gap-2">
            {bank?.isBankVerified && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 300, delay: 0.3 }}
              >
                <StatusPill verified />
              </motion.div>
            )}
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 88%)', color: 'var(--primary)' }}
            >
              <Shield size={14} />
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── Page Body ──────────────────────────────────────────────────────── */}
      <div className="container-custom max-w-3xl mx-auto px-4 py-6">

        {/* ── Current Bank Summary (read-only card) ──────────────────────── */}
        {bank && (bank.accountLast4 || bank.bankName) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-2xl p-5 mb-6 relative overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, var(--primary) 0%, color-mix(in srgb, var(--secondary), var(--primary) 40%) 100%)',
              boxShadow: '0 10px 30px color-mix(in srgb, var(--primary), transparent 65%)',
            }}
          >
            {/* decorative circles */}
            <div
              className="absolute -top-8 -right-8 w-32 h-32 rounded-full opacity-15"
              style={{ background: 'var(--primary-content)' }}
            />
            <div
              className="absolute -bottom-6 -left-4 w-20 h-20 rounded-full opacity-10"
              style={{ background: 'var(--accent)' }}
            />

            <div className="relative z-10">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest mb-1" style={{ color: 'color-mix(in srgb, var(--primary-content), transparent 30%)' }}>
                    Linked Account
                  </p>
                  <p className="font-montserrat text-xl font-black" style={{ color: 'var(--primary-content)' }}>
                    {bank.accountHolderName || driverMe?.legalName || '—'}
                  </p>
                </div>
                <Landmark size={28} style={{ color: 'color-mix(in srgb, var(--primary-content), transparent 25%)' }} />
              </div>

              <p className="font-mono text-lg font-bold tracking-widest mb-3" style={{ color: 'var(--primary-content)' }}>
                {maskAccount(bank.accountLast4)}
              </p>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--primary-content), transparent 30%)' }}>Bank</p>
                  <p className="text-sm font-bold" style={{ color: 'var(--primary-content)' }}>
                    {bank.bankName || '—'}
                  </p>
                </div>
                {bank.upiId && (
                  <div className="text-right">
                    <p className="text-xs" style={{ color: 'color-mix(in srgb, var(--primary-content), transparent 30%)' }}>UPI ID</p>
                    <p className="text-sm font-bold" style={{ color: 'var(--primary-content)' }}>
                      {bank.upiId}
                    </p>
                  </div>
                )}
                <div
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold"
                  style={{
                    background: bank.isBankVerified
                      ? 'color-mix(in srgb, var(--success), transparent 20%)'
                      : 'color-mix(in srgb, var(--warning), transparent 20%)',
                    color: bank.isBankVerified ? 'var(--success-content)' : 'var(--warning-content)',
                  }}
                >
                  {bank.isBankVerified ? <CheckCircle2 size={11} /> : <Clock size={11} />}
                  {bank.isBankVerified ? 'Verified' : 'Pending'}
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Info Banner ────────────────────────────────────────────────── */}
        <InfoBanner>
          Your bank details are used for earnings settlement. All data is encrypted and never shared with third parties. Updating account number triggers a fresh verification cycle.
        </InfoBanner>

        {/* ── Form ───────────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} noValidate>

          {/* §1 Account Holder */}
          <SectionCard
            title="Account Holder"
            subtitle="Name exactly as per bank records"
            icon={User}
            delay={0.05}
          >
            <div className="grid gap-4">

              {/* Account Holder Name */}
              <div>
                <FieldLabel icon={User} label="Account Holder Name" required />
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="e.g. Ravi Kumar"
                  value={form.accountHolderName}
                  onChange={(e) => handleChange('accountHolderName', e.target.value)}
                  autoComplete="name"
                />
                <FieldNote>
                  Must match your bank-registered name exactly — including middle name if present.
                </FieldNote>
                {errors.accountHolderName && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--error)' }}>
                    <AlertCircle size={11} /> {errors.accountHolderName}
                  </p>
                )}
              </div>
            </div>
          </SectionCard>

          {/* §2 Bank Account */}
          <SectionCard
            title="Bank Account"
            subtitle="Savings or Current account details"
            icon={Building2}
            delay={0.1}
          >
            <div className="grid gap-4">

              {/* Account Number */}
              <div>
                <FieldLabel icon={CreditCard} label="Account Number" required />
                {bank?.accountLast4 && (
                  <div
                    className="flex items-center gap-2 rounded-lg px-3 py-2 mb-2 text-sm"
                    style={{
                      background: 'color-mix(in srgb, var(--base-300), transparent 50%)',
                      border: '1px dashed color-mix(in srgb, var(--base-content), transparent 75%)',
                    }}
                  >
                    <Lock size={12} style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }} />
                    <span style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                      Saved: {maskAccount(bank.accountLast4)}
                    </span>
                  </div>
                )}
                <input
                  type="text"
                  inputMode="numeric"
                  className="input-field w-full"
                  placeholder="Enter new account number to update"
                  value={form.accountNumber}
                  onChange={(e) => handleChange('accountNumber', e.target.value.replace(/\D/g, ''))}
                  maxLength={18}
                  autoComplete="off"
                />
                <FieldNote>
                  9–18 digit account number. Enter new number only if you want to update — existing masked number stays if left blank.
                </FieldNote>
                {errors.accountNumber && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--error)' }}>
                    <AlertCircle size={11} /> {errors.accountNumber}
                  </p>
                )}
              </div>

              {/* IFSC Code */}
              <div>
                <FieldLabel icon={Hash} label="IFSC Code" required />
                <div className="relative">
                  <input
                    type="text"
                    className="input-field w-full uppercase pr-10"
                    placeholder="e.g. SBIN0001234"
                    value={form.ifscCode}
                    onChange={(e) => handleChange('ifscCode', e.target.value.toUpperCase())}
                    maxLength={11}
                    autoComplete="off"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {ifscLoading
                      ? <div className="loading loading-spinner loading-xs" style={{ borderTopColor: 'var(--primary)' }} />
                      : ifscMeta
                        ? <CheckCircle2 size={15} style={{ color: 'var(--success)' }} />
                        : null}
                  </div>
                </div>
                <FieldNote>
                  11-character code on your cheque leaf or passbook — format: ABCD0123456.
                </FieldNote>
                {ifscMeta && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mt-2 rounded-lg px-3 py-2 text-xs"
                    style={{
                      background: 'color-mix(in srgb, var(--success), transparent 90%)',
                      border: '1px solid color-mix(in srgb, var(--success), transparent 65%)',
                      color: 'var(--base-content)',
                    }}
                  >
                    <span className="font-semibold">{ifscMeta.BANK}</span>
                    {' — '}{ifscMeta.BRANCH}, {ifscMeta.CITY}, {ifscMeta.STATE}
                  </motion.div>
                )}
                {errors.ifscCode && (
                  <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--error)' }}>
                    <AlertCircle size={11} /> {errors.ifscCode}
                  </p>
                )}
              </div>

              {/* Bank Name */}
              <div>
                <FieldLabel icon={Landmark} label="Bank Name" />
                <input
                  type="text"
                  className="input-field w-full"
                  placeholder="Auto-filled from IFSC or enter manually"
                  value={form.bankName}
                  onChange={(e) => handleChange('bankName', e.target.value)}
                />
                <FieldNote>
                  Auto-populated when a valid IFSC is entered. You can also type it manually.
                </FieldNote>
              </div>

            </div>
          </SectionCard>

          {/* §3 UPI */}
          <SectionCard
            title="UPI Handle"
            subtitle="Optional — for faster payouts"
            icon={Smartphone}
            delay={0.15}
          >
            <div>
              <FieldLabel icon={Wallet} label="UPI ID" />
              <input
                type="text"
                className="input-field w-full"
                placeholder="e.g. ravikumar@upi"
                value={form.upiId}
                onChange={(e) => handleChange('upiId', e.target.value.trim())}
                autoComplete="off"
              />
              <FieldNote>
                Format: mobilenumber@bankname or username@upi. Used for instant settlement when supported.
              </FieldNote>
              {errors.upiId && (
                <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--error)' }}>
                  <AlertCircle size={11} /> {errors.upiId}
                </p>
              )}
            </div>
          </SectionCard>

          {/* §4 Settlement Info (read-only) */}
          {bank && (
            <SectionCard
              title="Settlement Overview"
              subtitle="Your current earnings status"
              icon={PiggyBank}
              delay={0.2}
            >
              <div className="grid grid-cols-2 gap-4">
                {[
                  {
                    label: 'Pending Settlement',
                    value: bank.pendingSettlementAmount != null
                      ? `₹${bank.pendingSettlementAmount.toLocaleString('en-IN')}`
                      : '₹0',
                    color: 'var(--warning)',
                  },
                  {
                    label: 'Total Settled',
                    value: bank.totalSettledAmount != null
                      ? `₹${bank.totalSettledAmount.toLocaleString('en-IN')}`
                      : '₹0',
                    color: 'var(--success)',
                  },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-xl p-4"
                    style={{ background: 'var(--base-200)', border: '1px solid var(--base-300)' }}
                  >
                    <p className="text-xs mb-1" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                      {item.label}
                    </p>
                    <p className="font-montserrat text-xl font-black" style={{ color: item.color }}>
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              {bank.lastSettledAt && (
                <p className="text-xs mt-3 flex items-center gap-1.5" style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  <RefreshCw size={11} />
                  Last settled: {new Date(bank.lastSettledAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              )}

              <FieldNote>
                Settlements are processed based on your chosen cycle (Weekly / Bi-Weekly / Monthly). Contact support for early payouts.
              </FieldNote>
            </SectionCard>
          )}

          {/* §5 Security note */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25, duration: 0.4 }}
            className="flex items-start gap-3 rounded-xl px-4 py-3 mb-6 text-sm"
            style={{
              background: 'color-mix(in srgb, var(--success), transparent 92%)',
              border: '1px solid color-mix(in srgb, var(--success), transparent 70%)',
            }}
          >
            <Shield size={15} className="mt-0.5 flex-shrink-0" style={{ color: 'var(--success)' }} />
            <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 70%, transparent)' }}>
              <strong>Bank-grade security.</strong> Account numbers are masked immediately after saving. Full numbers are never displayed or stored in readable form.
            </p>
          </motion.div>

          {/* ── Submit Button ─────────────────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.4 }}
          >
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary w-full btn-lg relative overflow-hidden"
              style={{ boxShadow: '0 6px 20px color-mix(in srgb, var(--primary), transparent 60%)' }}
            >
              <AnimatePresence mode="wait">
                {saved ? (
                  <motion.span
                    key="saved"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle2 size={17} />
                    Saved Successfully
                  </motion.span>
                ) : loading ? (
                  <motion.span
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <div className="loading loading-spinner loading-sm" />
                    Saving…
                  </motion.span>
                ) : (
                  <motion.span
                    key="default"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="flex items-center gap-2"
                  >
                    <Save size={17} />
                    Save Bank Details
                    <ChevronRight size={15} className="ml-auto opacity-60" />
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          </motion.div>

          <p className="text-center text-xs mt-4" style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>
            Changes take effect after admin verification (usually within 1 business day).
          </p>

        </form>
      </div>
    </div>
  );
}