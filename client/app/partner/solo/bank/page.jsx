'use client';

import { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Building2, CreditCard, CheckCircle2, AlertCircle, Lock,
  Eye, EyeOff, ChevronRight, Landmark, Wallet, Shield,
  RefreshCw, Save, BadgeCheck, Clock, Info
} from 'lucide-react';
import {
  fetchBankDetails,
  submitBankDetails,
  selectBankDetails,
  selectLoading,
  selectError,
} from '@/store/slices/soloDriverSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';
import BackButton from '../../../../components/BackButton';

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] } }),
};

const ACCOUNT_TYPES = ['Savings', 'Current'];

function StatusPill({ verified }) {
  return verified ? (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-success/15 text-success border border-success/30">
      <BadgeCheck size={13} /> Verified
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-warning/15 text-warning border border-warning/30">
      <Clock size={13} /> Pending Verification
    </span>
  );
}

function MaskedCard({ bankDetails }) {
  const [reveal, setReveal] = useState(false);
  if (!bankDetails) return null;
  const { bankDetails: bd } = bankDetails;
  if (!bd?.ifscCode && !bd?.bankName) return null;

  return (
    <motion.div
      variants={fadeUp} custom={0} initial="hidden" animate="show"
      className="relative overflow-hidden rounded-2xl p-6 mb-8"
      style={{
        background: 'linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%)',
        boxShadow: '0 20px 60px color-mix(in srgb, var(--primary), transparent 60%)',
      }}
    >
      {/* Decorative circles */}
      <div className="absolute -top-8 -right-8 w-40 h-40 rounded-full opacity-20"
        style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />
      <div className="absolute -bottom-10 -left-10 w-52 h-52 rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, white 0%, transparent 70%)' }} />

      <div className="relative z-10">
        <div className="flex items-start justify-between mb-6">
          <div>
            <p className="text-white/60 text-xs font-semibold uppercase tracking-widest mb-1">Bank Account</p>
            <p className="text-white font-bold text-lg">{bd?.bankName || '—'}</p>
          </div>
          <div className="w-12 h-12 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(255,255,255,0.2)' }}>
            <Landmark size={22} className="text-white" />
          </div>
        </div>

        <div className="mb-5">
          <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">Account Number</p>
          <div className="flex items-center gap-3">
            <p className="text-white font-mono text-xl tracking-widest">
              {reveal ? `•••• •••• ${bd?.accountLast4 || '----'}` : `XXXX XXXX XXXX ${bd?.accountLast4 || '----'}`}
            </p>
            <button onClick={() => setReveal(v => !v)}
              className="p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
              {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">IFSC Code</p>
            <p className="text-white font-mono font-semibold">{bd?.ifscCode || '—'}</p>
          </div>
          <div>
            <p className="text-white/60 text-xs mb-1 uppercase tracking-wider">Account Type</p>
            <p className="text-white font-semibold">{bd?.accountType || '—'}</p>
          </div>
        </div>

        <div className="mt-5 pt-5 border-t border-white/20 flex items-center justify-between">
          <div>
            <p className="text-white/60 text-xs mb-0.5">Account Holder</p>
            <p className="text-white font-semibold">{bd?.accountHolderName || '—'}</p>
          </div>
          <StatusPill verified={bd?.isVerified} />
        </div>
      </div>
    </motion.div>
  );
}

export default function BankDetails() {
  const dispatch = useDispatch();
  const bankDetails = useSelector(selectBankDetails);
  const loading = useSelector(selectLoading('bank'));
  const submitting = useSelector(selectLoading('submitBank'));
  const error = useSelector(selectError('submitBank'));

  const [form, setForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    upiId: '',
    upiName: '',
    accountType: 'Savings',
    cancelledChequeUrl: '',
  });
  const [chequeFile, setChequeFile] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => { dispatch(fetchBankDetails()); }, [dispatch]);

  useEffect(() => {
    const bd = bankDetails?.bankDetails;
    if (bd) {
      setForm(f => ({
        ...f,
        accountHolderName: bd.accountHolderName || '',
        ifscCode: bd.ifscCode || '',
        bankName: bd.bankName || '',
        upiId: bd.upiId || '',
        upiName: bd.upiName || '',
        accountType: bd.accountType || 'Savings',
        cancelledChequeUrl: bd.cancelledChequeUrl || '',
      }));
    }
  }, [bankDetails]);

  const handleChange = e => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleChequeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setChequeFile(file);
    setUploading(true);
    try {
      const result = await dispatch(uploadSingleFile({ file, folder: 'bank-docs' })).unwrap();
      setForm(f => ({ ...f, cancelledChequeUrl: result.url }));
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    await dispatch(submitBankDetails(form));
    dispatch(fetchBankDetails());
    setShowForm(false);
  };

  const hasBankData = bankDetails?.bankDetails?.ifscCode;

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="max-w-2xl mx-auto px-4 py-8">
      <BackButton className=' my-2 rounded-md px-3' />
        {/* Header */}
        <motion.div variants={fadeUp} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
              <Building2 size={20} style={{ color: 'var(--primary)' }} />
            </div>
            <div>
              <h1 className="text-2xl font-black" style={{ fontFamily: 'var(--font-display)', color: 'var(--base-content)' }}>
                Bank Details
              </h1>
              <p className="text-sm" style={{ color: 'color-mix(in oklch, var(--base-content) 55%, transparent)' }}>
                Manage your settlement account
              </p>
            </div>
          </div>
        </motion.div>

        {/* Security notice */}
        <motion.div variants={fadeUp} custom={0.5} initial="hidden" animate="show"
          className="flex items-start gap-3 p-4 rounded-xl mb-6"
          style={{ background: 'color-mix(in srgb, var(--info), transparent 90%)', border: '1px solid color-mix(in srgb, var(--info), transparent 70%)' }}>
          <Shield size={16} className="mt-0.5 shrink-0" style={{ color: 'var(--info)' }} />
          <p className="text-xs leading-relaxed" style={{ color: 'var(--base-content)' }}>
            Your bank details are encrypted and secured. Account numbers are masked and never displayed in full.
            Verification takes 1–2 business days.
          </p>
        </motion.div>

        {/* Loading skeleton */}
        {loading && (
          <div className="space-y-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton h-16 rounded-xl" />
            ))}
          </div>
        )}

        {/* Existing card */}
        {!loading && <MaskedCard bankDetails={bankDetails} />}

        {/* UPI Section */}
        {!loading && bankDetails?.bankDetails?.upiId && (
          <motion.div variants={fadeUp} custom={1} initial="hidden" animate="show"
            className="card p-5 mb-6 flex items-center gap-4">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'color-mix(in srgb, var(--success), transparent 85%)' }}>
              <Wallet size={18} style={{ color: 'var(--success)' }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider mb-0.5"
                style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>UPI ID</p>
              <p className="font-mono font-semibold text-sm truncate" style={{ color: 'var(--base-content)' }}>
                {bankDetails.bankDetails.upiId}
              </p>
            </div>
            <CheckCircle2 size={18} style={{ color: 'var(--success)' }} />
          </motion.div>
        )}

        {/* Toggle Form Button */}
        <motion.div variants={fadeUp} custom={1.5} initial="hidden" animate="show">
          <button
            onClick={() => setShowForm(v => !v)}
            className="w-full flex items-center justify-between p-4 rounded-xl font-semibold text-sm transition-all"
            style={{
              background: showForm ? 'color-mix(in srgb, var(--primary), transparent 88%)' : 'var(--base-200)',
              border: `1px solid ${showForm ? 'color-mix(in srgb, var(--primary), transparent 60%)' : 'var(--base-300)'}`,
              color: showForm ? 'var(--primary)' : 'var(--base-content)',
            }}
          >
            <span className="flex items-center gap-2">
              <CreditCard size={16} />
              {hasBankData ? 'Update Bank Details' : 'Add Bank Account'}
            </span>
            <motion.div animate={{ rotate: showForm ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight size={16} />
            </motion.div>
          </button>
        </motion.div>

        {/* Form */}
        <AnimatePresence>
          {showForm && (
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-6 space-y-5">

                {/* Account Holder */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                    Account Holder Name *
                  </label>
                  <input
                    name="accountHolderName" value={form.accountHolderName} onChange={handleChange}
                    placeholder="Full name as on bank account"
                    required className="input-field w-full"
                  />
                </div>

                {/* Account Number */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                    Account Number *
                  </label>
                  <input
                    name="accountNumber" value={form.accountNumber} onChange={handleChange}
                    placeholder="Enter account number"
                    required className="input-field w-full font-mono tracking-widest"
                  />
                </div>

                {/* IFSC + Bank Name */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                      IFSC Code *
                    </label>
                    <input
                      name="ifscCode" value={form.ifscCode} onChange={handleChange}
                      placeholder="SBIN0001234"
                      required className="input-field w-full font-mono uppercase"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                      style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                      Bank Name *
                    </label>
                    <input
                      name="bankName" value={form.bankName} onChange={handleChange}
                      placeholder="State Bank of India"
                      required className="input-field w-full"
                    />
                  </div>
                </div>

                {/* Account Type */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                    Account Type
                  </label>
                  <div className="flex gap-3">
                    {ACCOUNT_TYPES.map(type => (
                      <button key={type} type="button"
                        onClick={() => setForm(f => ({ ...f, accountType: type }))}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
                        style={{
                          background: form.accountType === type ? 'var(--primary)' : 'var(--base-200)',
                          color: form.accountType === type ? 'var(--primary-content)' : 'var(--base-content)',
                          border: `1px solid ${form.accountType === type ? 'var(--primary)' : 'var(--base-300)'}`,
                        }}
                      >
                        {type}
                      </button>
                    ))}
                  </div>
                </div>

                {/* UPI */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                    UPI ID <span style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>(optional)</span>
                  </label>
                  <input
                    name="upiId" value={form.upiId} onChange={handleChange}
                    placeholder="yourname@upi"
                    className="input-field w-full"
                  />
                </div>

                {/* Cancelled Cheque */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 60%, transparent)' }}>
                    Cancelled Cheque <span style={{ color: 'color-mix(in oklch, var(--base-content) 40%, transparent)' }}>(optional)</span>
                  </label>
                  <label className="flex items-center gap-3 p-4 rounded-xl cursor-pointer transition-all hover:border-primary"
                    style={{ border: '1.5px dashed var(--base-300)', background: 'var(--base-200)' }}>
                    <input type="file" accept="image/*,.pdf" onChange={handleChequeUpload} className="hidden" />
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center"
                      style={{ background: 'color-mix(in srgb, var(--primary), transparent 85%)' }}>
                      {uploading ? <RefreshCw size={14} className="animate-spin" style={{ color: 'var(--primary)' }} />
                        : <CreditCard size={14} style={{ color: 'var(--primary)' }} />}
                    </div>
                    <div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--base-content)' }}>
                        {chequeFile ? chequeFile.name : 'Upload Cancelled Cheque'}
                      </p>
                      <p className="text-xs" style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>
                        JPG, PNG or PDF
                      </p>
                    </div>
                    {form.cancelledChequeUrl && <CheckCircle2 size={16} className="ml-auto" style={{ color: 'var(--success)' }} />}
                  </label>
                </div>

                {/* Error */}
                {error && (
                  <div className="alert alert-error">
                    <AlertCircle size={16} />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                {/* Submit */}
                <button type="submit" disabled={submitting || uploading}
                  className="btn-primary-cta w-full flex items-center justify-center gap-2">
                  {submitting
                    ? <><RefreshCw size={16} className="animate-spin" /> Submitting...</>
                    : <><Save size={16} /> Save Bank Details</>}
                </button>

                <div className="flex items-center gap-2 justify-center text-xs"
                  style={{ color: 'color-mix(in oklch, var(--base-content) 45%, transparent)' }}>
                  <Lock size={12} />
                  <span>256-bit encrypted · Verified within 1–2 business days</span>
                </div>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Settlement Cycle Info */}
        {bankDetails?.settlement && (
          <motion.div variants={fadeUp} custom={2} initial="hidden" animate="show" className="mt-6">
            <div className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Info size={16} style={{ color: 'var(--info)' }} />
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: 'color-mix(in oklch, var(--base-content) 50%, transparent)' }}>Preferred Settlement</p>
                  <p className="font-bold text-sm" style={{ color: 'var(--base-content)' }}>
                    {bankDetails.settlement?.preferredMethod || 'Bank Transfer'}
                  </p>
                </div>
              </div>
              <span className="badge badge-info">{bankDetails.settlement?.preferredMethod === 'UPI' ? 'UPI' : 'NEFT'}</span>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}