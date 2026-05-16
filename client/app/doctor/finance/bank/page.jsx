'use client';

import { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet, Building2, Hash, CreditCard, User, Link,
  ShieldCheck, AlertCircle, CheckCircle, Eye, EyeOff,
  Save, Loader2, FileText, Phone,
} from 'lucide-react';
import {
  fetchMyDoctorProfile,
  updateDoctorBankDetails,
  selectMyDoctorProfile,
  selectHospitalLoading,
} from '@/store/slices/hospitalSlice';

/* ─── animation ─── */
const fadeUp = {
  hidden: { opacity: 0, y: 16 },
  show: (i = 0) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.07, duration: 0.4, ease: 'easeOut' },
  }),
};

/* ─── field wrapper ─── */
const Field = ({ label, icon: Icon, children, required }) => (
  <div className="space-y-1.5">
    <label className="flex items-center gap-1.5 text-xs font-semibold text-base-content/50 uppercase tracking-wider">
      <Icon className="w-3.5 h-3.5 text-primary" />
      {label}
      {required && <span className="text-error">*</span>}
    </label>
    {children}
  </div>
);

/* ─── input ─── */
const Input = ({ value, onChange, placeholder, type = 'text', disabled, className = '' }) => (
  <input
    type={type}
    value={value}
    onChange={onChange}
    placeholder={placeholder}
    disabled={disabled}
    className={`input-field ${className}`}
  />
);

/* ─── section card ─── */
const SectionCard = ({ children }) => (
  <div className="p-6 rounded-2xl border border-base-300/60 bg-base-200 space-y-5">
    {children}
  </div>
);

const SectionTitle = ({ children, icon: Icon }) => (
  <h2 className="text-xs font-bold text-base-content/50 uppercase tracking-widest flex items-center gap-2">
    <Icon className="w-3.5 h-3.5 text-primary" />
    {children}
  </h2>
);

/* ─── main page ─── */
export default function BankDetails() {
  const dispatch = useDispatch();
  const profile  = useSelector(selectMyDoctorProfile);
  const loading  = useSelector(selectHospitalLoading);

  const [form, setForm] = useState({
    accountHolderName:  '',
    accountNumber:      '',
    ifscCode:           '',
    bankName:           '',
    branchName:         '',
    upiId:              '',
    gstNumber:          '',
    cancelledChequeUrl: '',
  });
  const [showAccount, setShowAccount] = useState(false);
  const [dirty, setDirty]             = useState(false);

  useEffect(() => {
    if (!profile) dispatch(fetchMyDoctorProfile());
  }, [dispatch, profile]);

  useEffect(() => {
    if (profile?.bankDetails) {
      const bd = profile.bankDetails;
      setForm((f) => ({
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

  const set = (key) => (e) => {
    setForm((f) => ({ ...f, [key]: e.target.value }));
    setDirty(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!profile?._id) return;
    const payload = { id: profile._id, ...form };
    if (!form.accountNumber) delete payload.accountNumber;
    await dispatch(updateDoctorBankDetails(payload));
    setDirty(false);
  };

  const isSaving   = loading.updateDoctorBankDetails;
  const bd         = profile?.bankDetails;
  const isVerified = bd?.isBankVerified;

  return (
    <div className="min-h-screen bg-base-100 text-base-content font-[family-name:var(--font-family-poppins)]">

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 py-8">

        {/* ── Header ── */}
        <motion.div variants={fadeUp} custom={0} initial="hidden" animate="show" className="mb-8">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2.5 rounded-xl bg-primary">
              <Wallet className="w-5 h-5 text-primary-content" />
            </div>
            <h1 className="text-2xl font-black tracking-tight text-base-content">Bank Details</h1>
          </div>
          <p className="text-sm text-base-content/50 ml-[3.25rem]">
            Manage your bank account for earnings settlement
          </p>
        </motion.div>

        {/* ── Verification banner ── */}
        <AnimatePresence>
          {profile && (
            <motion.div
              variants={fadeUp} custom={1} initial="hidden" animate="show"
              className={`mb-6 flex items-start gap-3 p-4 rounded-xl border ${
                isVerified
                  ? 'border-success/30 bg-success/5'
                  : 'border-warning/30 bg-warning/5'
              }`}
            >
              {isVerified
                ? <ShieldCheck className="w-5 h-5 text-success flex-shrink-0 mt-0.5" />
                : <AlertCircle className="w-5 h-5 text-warning flex-shrink-0 mt-0.5" />
              }
              <div>
                <p className={`text-sm font-semibold ${isVerified ? 'text-success' : 'text-warning'}`}>
                  {isVerified ? 'Bank Account Verified' : 'Pending Verification'}
                </p>
                <p className="text-xs text-base-content/50 mt-0.5">
                  {isVerified
                    ? `Verified on ${bd?.verifiedAt ? new Date(bd.verifiedAt).toLocaleDateString('en-IN') : '—'}`
                    : 'Your bank details will be reviewed by admin. Settlements activate after verification.'
                  }
                </p>
                {bd?.accountLast4 && (
                  <p className="text-xs text-base-content/30 mt-1">
                    Account ending in •••• {bd.accountLast4}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Form ── */}
        <motion.form
          onSubmit={handleSubmit}
          variants={fadeUp} custom={2} initial="hidden" animate="show"
          className="space-y-5"
        >
          {/* Account information */}
          <SectionCard>
            <SectionTitle icon={Building2}>Account Information</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="Account Holder Name" icon={User} required>
                <Input
                  value={form.accountHolderName}
                  onChange={set('accountHolderName')}
                  placeholder="As per bank records"
                />
              </Field>

              <Field label="Bank Name" icon={Building2} required>
                <Input
                  value={form.bankName}
                  onChange={set('bankName')}
                  placeholder="e.g. State Bank of India"
                />
              </Field>

              <Field
                label={`Account Number${bd?.accountLast4 ? ` (•••• ${bd.accountLast4})` : ''}`}
                icon={CreditCard}
              >
                <div className="relative">
                  <Input
                    type={showAccount ? 'text' : 'password'}
                    value={form.accountNumber}
                    onChange={set('accountNumber')}
                    placeholder={bd?.accountLast4 ? `Leave blank to keep ••••${bd.accountLast4}` : 'Enter account number'}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAccount((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-base-content/40 hover:text-base-content transition-colors"
                  >
                    {showAccount ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </Field>

              <Field label="IFSC Code" icon={Hash} required>
                <Input
                  value={form.ifscCode}
                  onChange={(e) => {
                    setForm((f) => ({ ...f, ifscCode: e.target.value.toUpperCase() }));
                    setDirty(true);
                  }}
                  placeholder="e.g. SBIN0001234"
                  className="uppercase tracking-widest font-mono"
                />
              </Field>

              <Field label="Branch Name" icon={Building2}>
                <Input
                  value={form.branchName}
                  onChange={set('branchName')}
                  placeholder="e.g. Vijayawada Main Branch"
                />
              </Field>

              <Field label="UPI ID" icon={Phone}>
                <Input
                  value={form.upiId}
                  onChange={set('upiId')}
                  placeholder="name@bankname"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Tax & documents */}
          <SectionCard>
            <SectionTitle icon={FileText}>Tax &amp; Documents</SectionTitle>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <Field label="GST Number" icon={Hash}>
                <Input
                  value={form.gstNumber}
                  onChange={set('gstNumber')}
                  placeholder="22AAAAA0000A1Z5"
                  className="uppercase font-mono"
                />
              </Field>

              <Field label="Cancelled Cheque URL" icon={Link}>
                <Input
                  value={form.cancelledChequeUrl}
                  onChange={set('cancelledChequeUrl')}
                  placeholder="https://…"
                />
              </Field>
            </div>
          </SectionCard>

          {/* Info note */}
          <div className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-info/10 border border-info/30">
            <ShieldCheck className="w-4 h-4 text-info flex-shrink-0 mt-0.5" />
            <p className="text-xs text-base-content/50 leading-relaxed">
              Updating bank details will reset verification status. Admin will re-verify within 1–2 business days before settlements resume. Account number is stored securely and only the last 4 digits are visible.
            </p>
          </div>

          {/* Submit */}
          <motion.button
            type="submit"
            disabled={isSaving || !dirty}
            whileHover={{ scale: isSaving || !dirty ? 1 : 1.02 }}
            whileTap={{ scale: isSaving || !dirty ? 1 : 0.97 }}
            className="btn btn-primary w-full py-3.5 text-sm disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isSaving
              ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving…</>
              : <><Save className="w-4 h-4" /> Save Bank Details</>
            }
          </motion.button>

          {!dirty && bd?.isBankVerified === false && bd?.accountLast4 && (
            <div className="flex items-center justify-center gap-2 text-xs text-base-content/40">
              <CheckCircle className="w-3.5 h-3.5" /> Details saved. Awaiting admin verification.
            </div>
          )}
        </motion.form>

      </div>
    </div>
  );
}