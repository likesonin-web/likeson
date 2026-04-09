'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Building2, Hash, CreditCard, User, Link,
  ShieldCheck, AlertCircle, CheckCircle, Eye, EyeOff,
  Save, Loader2, FileText, Phone
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  updateDoctorBankDetails,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

const fadeUp = {
  hidden: { opacity: 0, y: 20 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { delay: i * 0.07, duration: 0.45, ease: 'easeOut' } }),
};

const Field = ({ label, icon: Icon, children, required }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 uppercase tracking-wider">
      <Icon className="w-3.5 h-3.5" /> {label}
      {required && <span className="text-red-400">*</span>}
    </label>
    {children}
  </div>
);

const Input = ({ value, onChange, placeholder, type = 'text', disabled, className = '' }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className={`w-full px-4 py-3 rounded-xl bg-slate-800/60 border border-white/[0.07] text-white placeholder-slate-500
      text-sm outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/20 transition-all
      disabled:opacity-40 disabled:cursor-not-allowed ${className}`}
  />
);

export default function BankDetails() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);

  const [form, setForm] = useState({
    accountHolderName: '',
    accountNumber: '',
    ifscCode: '',
    bankName: '',
    branchName: '',
    upiId: '',
    gstNumber: '',
    cancelledChequeUrl: '',
  });
  const [showAccount, setShowAccount] = useState(false);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?.bankDetails) {
      const bd = profile.bankDetails;
      setForm(f => ({
        ...f,
        accountHolderName:  bd.accountHolderName  || '',
        ifscCode:           bd.ifscCode            || '',
        bankName:           bd.bankName            || '',
        branchName:         bd.branchName          || '',
        upiId:              bd.upiId               || '',
        gstNumber:          bd.gstNumber           || '',
        cancelledChequeUrl: bd.cancelledChequeUrl  || '',
      }));
    }
  }, [profile]);

  const set = (key) => (e) => { setForm(f => ({ ...f, [key]: e.target.value })); setDirty(true); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?._id) return;
    const payload = { id: profile._id, ...form };
    if (!form.accountNumber) delete payload.accountNumber;
    await dispatch(updateDoctorBankDetails(payload));
    setDirty(false);
  };

  const isSaving = loading.updateDoctorBankDetails;
  const bd = profile?.bankDetails;
  const isVerified = bd?.isBankVerified;

  return (
    <div className="min-h-screen bg-[#080c14] text-white font-[family-name:var(--font-family-poppins)]">
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 right-1/3 w-80 h-80 bg-emerald-600/6 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 left-1/4 w-64 h-64 bg-blue-600/5 rounded-full blur-3xl" />
      </div>

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* Header */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-600 to-teal-500 shadow-lg shadow-emerald-600/20">
              <Wallet className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-2xl font-black tracking-tight">Bank Details</h1>
          </div>
          <p className="text-slate-500 text-sm ml-12">Manage your bank account for earnings settlement</p>
        </motion.div>

        {/* Verification status banner */}
        <AnimatePresence>
          {profile && (
            <motion.div
              variants={fadeUp} custom={1} initial="hidden" animate="show"
              className={`mb-6 flex items-start gap-3 p-4 rounded-xl border
                ${isVerified
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-amber-500/20 bg-amber-500/5'}`}
            >
              {isVerified
                ? <ShieldCheck className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`text-sm font-semibold ${isVerified ? 'text-emerald-300' : 'text-amber-300'}`}>
                  {isVerified ? 'Bank Account Verified' : 'Pending Verification'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isVerified
                    ? `Verified on ${bd?.verifiedAt ? new Date(bd.verifiedAt).toLocaleDateString('en-IN') : '—'}`
                    : 'Your bank details will be reviewed by admin. Settlements activate after verification.'}
                </p>
                {bd?.accountLast4 && (
                  <p className="text-xs text-slate-500 mt-1">Account ending in •••• {bd.accountLast4}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Form */}
        <motion.form
          onSubmit={handleSubmit}
          variants={fadeUp} custom={2} initial="hidden" animate="show"
          className="space-y-6"
        >
          {/* Primary Section */}
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50 space-y-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <Building2 className="w-3.5 h-3.5 text-blue-400" /> Account Information
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Account Holder Name" icon={User} required>
                <Input value={form.accountHolderName} onChange={set('accountHolderName')} placeholder="As per bank records" />
              </Field>

              <Field label="Bank Name" icon={Building2} required>
                <Input value={form.bankName} onChange={set('bankName')} placeholder="e.g. State Bank of India" />
              </Field>

              <Field label={`Account Number ${bd?.accountLast4 ? `(•••• ${bd.accountLast4})` : ''}`} icon={CreditCard}>
                <div className="relative">
                  <Input
                    type={showAccount ? 'text' : 'password'}
                    value={form.accountNumber}
                    onChange={set('accountNumber')}
                    placeholder={bd?.accountLast4 ? `Leave blank to keep ••••${bd.accountLast4}` : "Enter account number"}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccount(v => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200 transition-colors"
                  >
                    {showAccount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field label="IFSC Code" icon={Hash} required>
                <Input
                  value={form.ifscCode}
                  onChange={(e) => { setForm(f => ({ ...f, ifscCode: e.target.value.toUpperCase() })); setDirty(true); }}
                  placeholder="e.g. SBIN0001234"
                  className="uppercase tracking-widest font-mono"
                />
              </Field>

              <Field label="Branch Name" icon={Building2}>
                <Input value={form.branchName} onChange={set('branchName')} placeholder="e.g. Vijayawada Main Branch" />
              </Field>

              <Field label="UPI ID" icon={Phone}>
                <Input value={form.upiId} onChange={set('upiId')} placeholder="name@bankname" />
              </Field>
            </div>
          </div>

          {/* Secondary Section */}
          <div className="p-6 rounded-2xl border border-white/[0.06] bg-slate-900/50 space-y-5">
            <h2 className="text-sm font-bold text-slate-300 uppercase tracking-widest flex items-center gap-2">
              <FileText className="w-3.5 h-3.5 text-violet-400" /> Tax & Documents
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="GST Number" icon={Hash}>
                <Input value={form.gstNumber} onChange={set('gstNumber')} placeholder="22AAAAA0000A1Z5" className="uppercase font-mono" />
              </Field>

              <Field label="Cancelled Cheque URL" icon={Link}>
                <Input value={form.cancelledChequeUrl} onChange={set('cancelledChequeUrl')} placeholder="https://..." />
              </Field>
            </div>
          </div>

          {/* Info note */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-blue-500/5 border border-blue-500/15">
            <ShieldCheck className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-slate-400 leading-relaxed">
              Updating bank details will reset verification status. Admin will re-verify within 1–2 business days before settlements resume. Account number is stored securely and only the last 4 digits are visible.
            </p>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={isSaving || !dirty}
            whileHover={{ scale: isSaving || !dirty ? 1 : 1.02 }}
            whileTap={{ scale: isSaving || !dirty ? 1 : 0.97 }}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm
              bg-gradient-to-r from-emerald-600 to-teal-500 text-white shadow-lg shadow-emerald-600/20
              disabled:opacity-40 disabled:cursor-not-allowed transition-all"
          >
            {isSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Bank Details</>
            }
          </motion.button>

          {!dirty && bd?.isBankVerified === false && bd?.accountLast4 && (
            <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
              <CheckCircle className="w-3.5 h-3.5" /> Details saved. Awaiting admin verification.
            </div>
          )}
        </motion.form>

      </div>
    </div>
  );
}