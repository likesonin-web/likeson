'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import {
  Plus, Trash2, Pencil, Eye, EyeOff, MousePointerClick,
  Image as ImageIcon, Link2, Upload, X, Check, ChevronDown,
  LayoutDashboard, MonitorSmartphone, Tablet, Monitor,
  Calendar, ArrowUpDown, Loader2, AlertCircle, TrendingUp,
  BarChart2, Layers, Clock, ExternalLink, RefreshCw, Search,
  Filter, MoreVertical, CheckCircle2, XCircle, Info
} from 'lucide-react';

import {
  fetchAllBanners,
  createBanner,
  updateBanner,
  deleteBanner,
} from '@/store/slices/bannerSlice';
import { uploadSingleFile, resetUploadState } from '@/store/slices/uploadSlice';

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

const POSITIONS = [
  { value: 'Home_Top',        label: 'Home — Top',        icon: '🏠' },
  { value: 'Home_Middle',     label: 'Home — Middle',     icon: '🏡' },
  { value: 'Medicine_Page',   label: 'Medicine Page',     icon: '💊' },
  { value: 'Lab_Page',        label: 'Lab Page',          icon: '🧪' },
  { value: 'Checkout_Bottom', label: 'Checkout — Bottom', icon: '🛒' },
];

const TARGET_TYPES = [
  { value: 'ExternalLink',   label: 'External Link',   icon: ExternalLink },
  { value: 'InternalRoute',  label: 'Internal Route',  icon: Link2 },
  { value: 'Product',        label: 'Product',         icon: Layers },
  { value: 'Hospital',       label: 'Hospital',        icon: LayoutDashboard },
  { value: 'Category',       label: 'Category',        icon: Filter },
  { value: 'Promotion',      label: 'Promotion',       icon: TrendingUp },
];

const SCREENS = ['mobile', 'tablet', 'desktop'];

const SCREEN_ICONS = { mobile: MonitorSmartphone, tablet: Tablet, desktop: Monitor };

const EMPTY_FORM = {
  title: '',
  subTitle: '',
  images: { mobile: '', tablet: '', desktop: '' },
  targetType: 'InternalRoute',
  targetId: '',
  externalUrl: '',
  position: 'Home_Top',
  priority: 0,
  isActive: true,
  startDate: '',
  endDate: '',
};

// ─────────────────────────────────────────────────────────────────────────────
// FIELD NOTE COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

const FieldNote = ({ text }) => (
  <p className="mt-1 flex items-center gap-1 text-xs text-base-content/50">
    <Info size={10} className="shrink-0" />
    {text}
  </p>
);

// ─────────────────────────────────────────────────────────────────────────────
// IMAGE INPUT — upload or paste link per screen
// ─────────────────────────────────────────────────────────────────────────────

const ImageInput = ({ screen, value, onChange, uploading, onUpload }) => {
  const [mode, setMode] = useState('link'); // 'link' | 'upload'
  const fileRef = useRef();
  const Icon = SCREEN_ICONS[screen];

  return (
    <div className="rounded-[var(--r-box)] border border-base-300 bg-base-200/60 p-3 space-y-2">
      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-base-content/70">
          <Icon size={13} />
          {screen}
        </span>
        <div className="flex gap-1">
          {['link', 'upload'].map(m => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`btn btn-xs rounded-full transition-all ${
                mode === m ? 'btn-primary' : 'btn-ghost text-base-content/50'
              }`}
            >
              {m === 'link' ? <Link2 size={11} /> : <Upload size={11} />}
              <span className="ml-1">{m === 'link' ? 'URL' : 'Upload'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Preview */}
      {value && (
        <div className="relative w-full h-16 rounded-[var(--r-field)] overflow-hidden bg-base-300 group">
          <img src={value} alt="preview" className="w-full h-full object-cover" />
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-1 right-1 btn btn-xs btn-circle btn-error opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <X size={10} />
          </button>
        </div>
      )}

      {/* Input */}
      {mode === 'link' ? (
        <input
          type="url"
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder={`https://cdn.example.com/${screen}-banner.jpg`}
          className="input-field w-full text-xs py-2"
        />
      ) : (
        <>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => e.target.files[0] && onUpload(e.target.files[0], screen)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="btn btn-outline w-full btn-sm gap-2"
          >
            {uploading
              ? <Loader2 size={13} className="animate-spin" />
              : <Upload size={13} />}
            {uploading ? 'Uploading…' : 'Choose Image'}
          </button>
        </>
      )}

      <FieldNote
        text={
          screen === 'mobile'
            ? 'Required. Used as fallback for tablet/desktop if not set.'
            : `Optional. Falls back to mobile image if left empty.`
        }
      />
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// BANNER FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const BannerFormModal = ({ open, onClose, editData }) => {
  const dispatch = useDispatch();
  const { loading } = useSelector(s => s.banners);
  const { isUploading, lastUploadedUrl } = useSelector(s => s.upload);

  const [form, setForm] = useState(EMPTY_FORM);
  const [uploadingScreen, setUploadingScreen] = useState(null);

  const isEdit = !!editData;

  // Populate form on edit
  useEffect(() => {
    if (editData) {
      setForm({
        ...EMPTY_FORM,
        ...editData,
        images: { mobile: '', tablet: '', desktop: '', ...editData.images },
        startDate: editData.startDate ? editData.startDate.slice(0, 10) : '',
        endDate: editData.endDate ? editData.endDate.slice(0, 10) : '',
      });
    } else {
      setForm(EMPTY_FORM);
    }
  }, [editData, open]);

  // When upload completes, assign URL to the pending screen
  useEffect(() => {
    if (lastUploadedUrl && uploadingScreen) {
      setForm(f => ({
        ...f,
        images: { ...f.images, [uploadingScreen]: lastUploadedUrl }
      }));
      setUploadingScreen(null);
      dispatch(resetUploadState());
    }
  }, [lastUploadedUrl, uploadingScreen, dispatch]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));
  const setImage = (screen, val) =>
    setForm(f => ({ ...f, images: { ...f.images, [screen]: val } }));

  const handleUpload = async (file, screen) => {
    setUploadingScreen(screen);
    dispatch(uploadSingleFile({ file, folder: 'banners' }));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    const payload = {
      ...form,
      startDate: form.startDate || undefined,
      endDate: form.endDate || undefined,
    };
    if (isEdit) {
      await dispatch(updateBanner({ id: editData._id, bannerData: payload }));
    } else {
      await dispatch(createBanner(payload));
    }
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
          onClick={e => e.target === e.currentTarget && onClose()}
        >
          <motion.div
            initial={{ opacity: 0, y: 32, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 16, scale: 0.97 }}
            transition={{ type: 'spring', stiffness: 380, damping: 30 }}
            className="card w-full max-w-2xl max-h-[92vh] overflow-y-auto"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-base-300 sticky top-0 bg-base-100 z-10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[var(--r-field)] bg-primary/10 flex items-center justify-center">
                  {isEdit ? <Pencil size={15} className="text-primary" /> : <Plus size={15} className="text-primary" />}
                </div>
                <div>
                  <h3 className="font-montserrat font-bold text-base text-base-content">
                    {isEdit ? 'Edit Banner' : 'Create Banner'}
                  </h3>
                  <p className="text-xs text-base-content/50">
                    {isEdit ? `Editing: ${editData.title}` : 'New promotional banner'}
                  </p>
                </div>
              </div>
              <button type="button" onClick={onClose} className="btn btn-ghost btn-sm btn-circle">
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-6">

              {/* ── Content ─────────────────────────────── */}
              <Section label="Content" icon={<Layers size={13} />}>
                <div className="space-y-3">
                  <div>
                    <label className="label-text block mb-1">Title <span className="text-error">*</span></label>
                    <input
                      required
                      value={form.title}
                      onChange={e => set('title', e.target.value)}
                      placeholder="Summer Health Sale"
                      className="input-field w-full"
                    />
                    <FieldNote text="Main headline shown on the banner. Keep under 60 characters." />
                  </div>
                  <div>
                    <label className="label-text block mb-1">Subtitle</label>
                    <input
                      value={form.subTitle}
                      onChange={e => set('subTitle', e.target.value)}
                      placeholder="Up to 40% off on medicines"
                      className="input-field w-full"
                    />
                    <FieldNote text="Optional. Shown below title in larger banner layouts." />
                  </div>
                </div>
              </Section>

              {/* ── Images per Screen ───────────────────── */}
              <Section label="Images — Per Screen" icon={<MonitorSmartphone size={13} />}>
                <div className="grid grid-cols-1 gap-3">
                  {SCREENS.map(screen => (
                    <ImageInput
                      key={screen}
                      screen={screen}
                      value={form.images[screen]}
                      onChange={val => setImage(screen, val)}
                      uploading={isUploading && uploadingScreen === screen}
                      onUpload={handleUpload}
                    />
                  ))}
                </div>
                <FieldNote text="Mobile image is required. Tablet & desktop are optional — fall back to mobile if empty." />
              </Section>

              {/* ── Navigation ──────────────────────────── */}
              <Section label="Navigation" icon={<Link2 size={13} />}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text block mb-1">Target Type <span className="text-error">*</span></label>
                    <Select
                      value={form.targetType}
                      onChange={val => set('targetType', val)}
                      options={TARGET_TYPES.map(t => ({ value: t.value, label: t.label }))}
                    />
                    <FieldNote text="How the banner navigates on click." />
                  </div>

                  {form.targetType === 'ExternalLink' ? (
                    <div>
                      <label className="label-text block mb-1">External URL <span className="text-error">*</span></label>
                      <input
                        required
                        type="url"
                        value={form.externalUrl}
                        onChange={e => set('externalUrl', e.target.value)}
                        placeholder="https://partner.com/offer"
                        className="input-field w-full"
                      />
                      <FieldNote text="Full URL for external partner links." />
                    </div>
                  ) : (
                    <div>
                      <label className="label-text block mb-1">Target ID</label>
                      <input
                        value={form.targetId}
                        onChange={e => set('targetId', e.target.value)}
                        placeholder="MongoDB ObjectId or slug"
                        className="input-field w-full"
                      />
                      <FieldNote text="ID or slug of the target product / hospital / category." />
                    </div>
                  )}
                </div>
              </Section>

              {/* ── Placement ───────────────────────────── */}
              <Section label="Placement" icon={<LayoutDashboard size={13} />}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text block mb-1">Position <span className="text-error">*</span></label>
                    <Select
                      value={form.position}
                      onChange={val => set('position', val)}
                      options={POSITIONS.map(p => ({ value: p.value, label: `${p.icon} ${p.label}` }))}
                    />
                    <FieldNote text="Page section where this banner will appear." />
                  </div>
                  <div>
                    <label className="label-text block mb-1">Priority</label>
                    <input
                      type="number"
                      value={form.priority}
                      onChange={e => set('priority', Number(e.target.value))}
                      className="input-field w-full"
                      min={0}
                      max={100}
                    />
                    <FieldNote text="Higher = shown first. Range 0–100." />
                  </div>
                </div>
              </Section>

              {/* ── Scheduling ──────────────────────────── */}
              <Section label="Scheduling" icon={<Calendar size={13} />}>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="label-text block mb-1">Start Date</label>
                    <input
                      type="date"
                      value={form.startDate}
                      onChange={e => set('startDate', e.target.value)}
                      className="input-field w-full"
                    />
                    <FieldNote text="Defaults to now if left empty." />
                  </div>
                  <div>
                    <label className="label-text block mb-1">End Date</label>
                    <input
                      type="date"
                      value={form.endDate}
                      onChange={e => set('endDate', e.target.value)}
                      className="input-field w-full"
                    />
                    <FieldNote text="Leave empty for no expiry. Banner auto-archives when expired." />
                  </div>
                </div>
                <div className="flex items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => set('isActive', !form.isActive)}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      form.isActive ? 'bg-success' : 'bg-base-300'
                    }`}
                  >
                    <motion.span
                      animate={{ x: form.isActive ? 16 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="inline-block h-4 w-4 rounded-full bg-white shadow"
                    />
                  </button>
                  <span className="text-sm font-semibold">
                    {form.isActive ? (
                      <span className="text-success">Active — visible to users</span>
                    ) : (
                      <span className="text-base-content/50">Inactive — hidden from users</span>
                    )}
                  </span>
                </div>
                <FieldNote text="Toggle visibility without deleting the banner." />
              </Section>

              {/* ── Actions ─────────────────────────────── */}
              <div className="flex gap-2 pt-1">
                <button type="button" onClick={onClose} className="btn btn-ghost flex-1">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loading || isUploading}
                  className="btn btn-primary flex-1 gap-2"
                >
                  {loading
                    ? <><Loader2 size={14} className="animate-spin" /> Saving…</>
                    : <><Check size={14} /> {isEdit ? 'Save Changes' : 'Create Banner'}</>
                  }
                </button>
              </div>
            </form>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const DeleteModal = ({ open, onClose, onConfirm, title, loading }) => (
  <AnimatePresence>
    {open && (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}
        onClick={e => e.target === e.currentTarget && onClose()}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="card w-full max-w-sm p-6 text-center space-y-4"
        >
          <div className="w-12 h-12 rounded-full bg-error/10 flex items-center justify-center mx-auto">
            <Trash2 size={20} className="text-error" />
          </div>
          <div>
            <h3 className="font-montserrat font-bold text-base-content">Delete Banner?</h3>
            <p className="text-sm text-base-content/60 mt-1">
              "<span className="font-semibold text-base-content">{title}</span>" will be permanently removed.
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost flex-1">Cancel</button>
            <button
              onClick={onConfirm}
              disabled={loading}
              className="btn btn-error flex-1 gap-2"
            >
              {loading ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              Delete
            </button>
          </div>
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

// ─────────────────────────────────────────────────────────────────────────────
// HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const Section = ({ label, icon, children }) => (
  <div className="space-y-3">
    <div className="flex items-center gap-2">
      <span className="text-primary">{icon}</span>
      <span className="text-xs font-bold uppercase tracking-widest text-base-content/60">{label}</span>
      <div className="flex-1 h-px bg-base-300" />
    </div>
    {children}
  </div>
);

const Select = ({ value, onChange, options }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef();
  const selected = options.find(o => o.value === value);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="input-field w-full flex items-center justify-between cursor-pointer"
      >
        <span className="text-sm">{selected?.label || 'Select…'}</span>
        <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="absolute z-50 w-full mt-1 card shadow-lg overflow-hidden"
          >
            {options.map(opt => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { onChange(opt.value); setOpen(false); }}
                className={`w-full text-left px-3 py-2 text-sm hover:bg-primary/5 transition-colors flex items-center justify-between ${
                  opt.value === value ? 'text-primary font-semibold bg-primary/5' : 'text-base-content'
                }`}
              >
                {opt.label}
                {opt.value === value && <Check size={12} className="text-primary" />}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────────────────────────────────────

const StatCard = ({ label, value, icon: Icon, color = 'primary', sub }) => (
  <motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="stat-card"
  >
    <div className="flex items-start justify-between">
      <div>
        <p className="stat-card-label">{label}</p>
        <p className="stat-card-value" style={{ color: `var(--${color})` }}>{value}</p>
        {sub && <p className="text-xs text-base-content/50 mt-1">{sub}</p>}
      </div>
      <div
        className="w-9 h-9 rounded-[var(--r-field)] flex items-center justify-center"
        style={{ background: `color-mix(in srgb, var(--${color}), transparent 88%)` }}
      >
        <Icon size={16} style={{ color: `var(--${color})` }} />
      </div>
    </div>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// BANNER ROW
// ─────────────────────────────────────────────────────────────────────────────

const BannerRow = ({ banner, index, onEdit, onDelete, onToggle }) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef();
  const ctr = banner.analytics?.views
    ? ((banner.analytics.clicks / banner.analytics.views) * 100).toFixed(1)
    : '0.0';

  const previewImg = banner.images?.mobile || banner.imageUrl || '';

  useEffect(() => {
    const h = e => { if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);

  return (
    <motion.tr
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.04 }}
      className="group"
    >
      {/* Image */}
      <td>
        <div className="w-16 h-10 rounded-[var(--r-field)] overflow-hidden bg-base-300 shrink-0">
          {previewImg
            ? <img src={previewImg} alt={banner.title} className="w-full h-full object-cover" />
            : <div className="w-full h-full flex items-center justify-center text-base-content/30">
                <ImageIcon size={16} />
              </div>
          }
        </div>
      </td>

      {/* Title & Position */}
      <td>
        <p className="font-semibold text-sm text-base-content line-clamp-1">{banner.title}</p>
        <p className="text-xs text-base-content/50 mt-0.5">{banner.subTitle || '—'}</p>
        <span className="badge badge-primary badge-xs mt-1">
          {POSITIONS.find(p => p.value === banner.position)?.label || banner.position}
        </span>
      </td>

      {/* Screens */}
      <td>
        <div className="flex gap-1">
          {SCREENS.map(s => {
            const has = !!banner.images?.[s];
            const Icon = SCREEN_ICONS[s];
            return (
              <span
                key={s}
                title={`${s}: ${has ? 'set' : 'not set'}`}
                className={`w-6 h-6 rounded flex items-center justify-center text-xs ${
                  has ? 'bg-success/10 text-success' : 'bg-base-300 text-base-content/30'
                }`}
              >
                <Icon size={12} />
              </span>
            );
          })}
        </div>
      </td>

      {/* Status */}
      <td>
        <button
          onClick={() => onToggle(banner)}
          className={`badge gap-1 cursor-pointer hover:opacity-80 transition-opacity ${
            banner.isActive ? 'badge-success' : 'badge-error'
          }`}
        >
          {banner.isActive
            ? <><CheckCircle2 size={10} /> Active</>
            : <><XCircle size={10} /> Inactive</>}
        </button>
      </td>

      {/* Analytics */}
      <td>
        <div className="space-y-0.5">
          <p className="text-xs flex items-center gap-1">
            <Eye size={10} className="text-info" />
            <span className="font-semibold">{banner.analytics?.views ?? 0}</span>
            <span className="text-base-content/40">views</span>
          </p>
          <p className="text-xs flex items-center gap-1">
            <MousePointerClick size={10} className="text-accent" />
            <span className="font-semibold">{banner.analytics?.clicks ?? 0}</span>
            <span className="text-base-content/40">clicks</span>
          </p>
          <p className="text-xs text-base-content/50">CTR: <span className="font-bold text-primary">{ctr}%</span></p>
        </div>
      </td>

      {/* Priority */}
      <td>
        <span className="badge badge-info badge-sm">{banner.priority}</span>
      </td>

      {/* Dates */}
      <td>
        <div className="text-xs text-base-content/60 space-y-0.5">
          <p>{banner.startDate ? new Date(banner.startDate).toLocaleDateString() : '—'}</p>
          <p className="text-error/70">{banner.endDate ? new Date(banner.endDate).toLocaleDateString() : 'No expiry'}</p>
        </div>
      </td>

      {/* Actions */}
      <td>
        <div ref={menuRef} className="relative flex items-center gap-1">
          <button
            onClick={() => onEdit(banner)}
            className="btn btn-ghost btn-xs btn-circle opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit"
          >
            <Pencil size={13} />
          </button>
          <button
            onClick={() => onDelete(banner)}
            className="btn btn-ghost btn-xs btn-circle text-error opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PANEL
// ─────────────────────────────────────────────────────────────────────────────

const AnalyticsPanel = ({ banners }) => {
  const chartData = banners
    .sort((a, b) => (b.analytics?.views ?? 0) - (a.analytics?.views ?? 0))
    .slice(0, 8)
    .map(b => ({
      name: b.title.length > 14 ? b.title.slice(0, 14) + '…' : b.title,
      views: b.analytics?.views ?? 0,
      clicks: b.analytics?.clicks ?? 0,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card p-5 space-y-4"
    >
      <div className="flex items-center gap-2">
        <BarChart2 size={15} className="text-primary" />
        <h3 className="font-montserrat font-bold text-sm text-base-content">Top Banners — Performance</h3>
      </div>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={chartData} barCategoryGap="30%">
          <XAxis
            dataKey="name"
            tick={{ fontSize: 10, fill: 'var(--base-content)', opacity: 0.6 }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis hide />
          <Tooltip
            contentStyle={{
              background: 'var(--base-100)',
              border: '1px solid var(--base-300)',
              borderRadius: 'var(--r-field)',
              fontSize: 12,
              color: 'var(--base-content)',
            }}
          />
          <Bar dataKey="views" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={`color-mix(in srgb, var(--primary), transparent ${i * 10}%)`} />
            ))}
          </Bar>
          <Bar dataKey="clicks" radius={[4, 4, 0, 0]}>
            {chartData.map((_, i) => (
              <Cell key={i} fill={`color-mix(in srgb, var(--accent), transparent ${i * 10}%)`} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex items-center gap-4 text-xs text-base-content/60">
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-primary inline-block" /> Views</span>
        <span className="flex items-center gap-1"><span className="w-3 h-2 rounded-sm bg-accent inline-block" /> Clicks</span>
      </div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN PAGE
// ─────────────────────────────────────────────────────────────────────────────

export default function BannersManagement() {
  const dispatch = useDispatch();
  const { adminBanners: banners, loading, error } = useSelector(s => s.banners);
  const { user } = useSelector(s => s.user);

  const [formOpen, setFormOpen] = useState(false);
  const [editData, setEditData] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [searchQ, setSearchQ] = useState('');
  const [filterPos, setFilterPos] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortKey, setSortKey] = useState('createdAt');
  const [showAnalytics, setShowAnalytics] = useState(false);

  useEffect(() => { dispatch(fetchAllBanners()); }, [dispatch]);

  // Derived stats
  const totalViews = banners.reduce((s, b) => s + (b.analytics?.views ?? 0), 0);
  const totalClicks = banners.reduce((s, b) => s + (b.analytics?.clicks ?? 0), 0);
  const activeBanners = banners.filter(b => b.isActive).length;
  const avgCTR = totalViews ? ((totalClicks / totalViews) * 100).toFixed(1) : '0.0';

  // Filter + sort
  const filtered = banners
    .filter(b => {
      const matchQ = b.title.toLowerCase().includes(searchQ.toLowerCase());
      const matchPos = filterPos === 'all' || b.position === filterPos;
      const matchStatus =
        filterStatus === 'all' ||
        (filterStatus === 'active' && b.isActive) ||
        (filterStatus === 'inactive' && !b.isActive);
      return matchQ && matchPos && matchStatus;
    })
    .sort((a, b) => {
      if (sortKey === 'priority') return (b.priority ?? 0) - (a.priority ?? 0);
      if (sortKey === 'views') return (b.analytics?.views ?? 0) - (a.analytics?.views ?? 0);
      if (sortKey === 'clicks') return (b.analytics?.clicks ?? 0) - (a.analytics?.clicks ?? 0);
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

  const handleEdit = banner => { setEditData(banner); setFormOpen(true); };
  const handleCreate = () => { setEditData(null); setFormOpen(true); };
  const handleDelete = banner => setDeleteTarget(banner);
  const handleToggle = async banner => {
    dispatch(updateBanner({ id: banner._id, bannerData: { isActive: !banner.isActive } }));
  };
  const confirmDelete = async () => {
    setDeleting(true);
    await dispatch(deleteBanner(deleteTarget._id));
    setDeleting(false);
    setDeleteTarget(null);
  };

  return (
    <div className="min-h-screen bg-base-100">
      <div className="container-custom py-6 max-w-7xl mx-auto space-y-6">

        {/* ── Page Header ─────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div>
            <div className="flex items-center gap-2 mb-1">
              <div className="w-8 h-8 rounded-[var(--r-field)] bg-primary flex items-center justify-center shadow-primary">
                <ImageIcon size={15} className="text-primary-content" />
              </div>
              <h1 className="font-montserrat font-black text-2xl text-base-content">
                Banner Management
              </h1>
            </div>
            <p className="text-sm text-base-content/50">
              Manage promotional banners across all screens and positions
              {user && <> · <span className="capitalize font-semibold text-primary">{user.role}</span></>}
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAnalytics(v => !v)}
              className={`btn btn-sm gap-2 ${showAnalytics ? 'btn-primary' : 'btn-outline'}`}
            >
              <BarChart2 size={14} />
              Analytics
            </button>
            <button
              onClick={() => dispatch(fetchAllBanners())}
              disabled={loading}
              className="btn btn-ghost btn-sm btn-circle"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
            <button onClick={handleCreate} className="btn btn-primary btn-sm gap-2">
              <Plus size={14} />
              New Banner
            </button>
          </div>
        </motion.div>

        {/* ── Stat Cards ──────────────────────────────────────── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Total Banners" value={banners.length} icon={Layers} color="primary" />
          <StatCard label="Active" value={activeBanners} icon={CheckCircle2} color="success" sub={`${banners.length - activeBanners} inactive`} />
          <StatCard label="Total Views" value={totalViews.toLocaleString()} icon={Eye} color="info" />
          <StatCard label="Avg CTR" value={`${avgCTR}%`} icon={TrendingUp} color="accent" sub={`${totalClicks.toLocaleString()} clicks`} />
        </div>

        {/* ── Analytics Panel ─────────────────────────────────── */}
        <AnimatePresence>
          {showAnalytics && banners.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <AnalyticsPanel banners={banners} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Filters ─────────────────────────────────────────── */}
        <div className="card p-4">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
              <input
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Search banners…"
                className="input-field w-full pl-9 py-2 text-sm"
              />
            </div>

            {/* Position Filter */}
            <select
              value={filterPos}
              onChange={e => setFilterPos(e.target.value)}
              className="input-field py-2 text-sm"
            >
              <option value="all">All Positions</option>
              {POSITIONS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
            </select>

            {/* Status Filter */}
            <select
              value={filterStatus}
              onChange={e => setFilterStatus(e.target.value)}
              className="input-field py-2 text-sm"
            >
              <option value="all">All Status</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>

            {/* Sort */}
            <select
              value={sortKey}
              onChange={e => setSortKey(e.target.value)}
              className="input-field py-2 text-sm"
            >
              <option value="createdAt">Newest First</option>
              <option value="priority">Priority</option>
              <option value="views">Most Views</option>
              <option value="clicks">Most Clicks</option>
            </select>

            <span className="text-xs text-base-content/40 ml-auto">
              {filtered.length} / {banners.length} banners
            </span>
          </div>
        </div>

        {/* ── Error ────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="alert alert-error"
            >
              <AlertCircle size={16} />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Table ────────────────────────────────────────────── */}
        <div className="card overflow-hidden">
          {loading && banners.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-3 text-base-content/40">
              <Loader2 size={28} className="animate-spin text-primary" />
              <span className="text-sm">Loading banners…</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-16 flex flex-col items-center gap-3 text-base-content/40">
              <ImageIcon size={32} />
              <p className="text-sm">
                {banners.length === 0 ? 'No banners yet. Create your first one!' : 'No banners match filters.'}
              </p>
              {banners.length === 0 && (
                <button onClick={handleCreate} className="btn btn-primary btn-sm gap-2 mt-2">
                  <Plus size={13} /> Create Banner
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table">
                <thead>
                  <tr>
                    <th>Image</th>
                    <th>Title / Position</th>
                    <th>Screens</th>
                    <th>Status</th>
                    <th>Analytics</th>
                    <th>
                      <button
                        onClick={() => setSortKey('priority')}
                        className="flex items-center gap-1 hover:text-primary transition-colors"
                      >
                        Priority <ArrowUpDown size={11} />
                      </button>
                    </th>
                    <th>Schedule</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((banner, i) => (
                    <BannerRow
                      key={banner._id}
                      banner={banner}
                      index={i}
                      onEdit={handleEdit}
                      onDelete={handleDelete}
                      onToggle={handleToggle}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Position Coverage ─────────────────────────────────── */}
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <LayoutDashboard size={14} className="text-primary" />
            <h3 className="font-montserrat font-bold text-sm text-base-content">Position Coverage</h3>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {POSITIONS.map(pos => {
              const count = banners.filter(b => b.position === pos.value).length;
              const activeCount = banners.filter(b => b.position === pos.value && b.isActive).length;
              return (
                <motion.button
                  key={pos.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setFilterPos(pos.value === filterPos ? 'all' : pos.value)}
                  className={`stat-card text-left transition-all ${
                    filterPos === pos.value ? 'border-2 border-primary' : ''
                  }`}
                >
                  <p className="text-xl mb-1">{pos.icon}</p>
                  <p className="text-xs font-bold text-base-content/70 leading-tight">{pos.label}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <span className="badge-success badge badge-xs">{activeCount} active</span>
                    <span className="text-xs text-base-content/40">{count} total</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <BannerFormModal
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditData(null); }}
        editData={editData}
      />

      <DeleteModal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
        title={deleteTarget?.title}
        loading={deleting}
      />
    </div>
  );
}