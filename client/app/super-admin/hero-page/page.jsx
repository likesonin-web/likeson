'use client';
 

import { useEffect, useState, useCallback, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Search, Filter, Eye, EyeOff, Trash2, Edit3,
  Image as ImageIcon, Upload, X, ChevronLeft, ChevronRight,
  TrendingUp, TrendingDown, ToggleLeft, ToggleRight,
  LayoutTemplate, Sparkles, AlertCircle, CheckCircle2,
  Clock, SlidersHorizontal, RefreshCw, ExternalLink,
  ArrowUpDown, MonitorPlay, FileImage, Layers
} from 'lucide-react';

import {
  fetchHeroPages,
  fetchHeroPageById,
  createHeroPage,
  updateHeroPage,
  toggleHeroPage,
  updateHeroPriority,
  replaceHeroMedia,
  deleteHeroPage,
  selectHero,
  clearSelectedHero,
  clearError,
  selectHeroes,
  selectHeroPagination,
  selectSelectedHero,
  selectUploadProgress,
  selectHeroError,
  selectLoadingList,
  selectLoadingCreate,
  selectLoadingUpdate,
  selectLoadingToggle,
  selectLoadingDelete,
  selectLoadingMedia,
  selectLoadingPriority,
  selectAnyHeroLoading,
} from '@/store/slices/heroPageSlice';

// ─────────────────────────────────────────────────────────────────────────────
// MICRO COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

const StatusBadge = ({ isActive }) => (
  <span
    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold tracking-wider uppercase ${
      isActive
        ? 'bg-success/15 text-success border border-success/30'
        : 'bg-base-300/60 text-base-content/50 border border-base-300'
    }`}
  >
    <span className={`w-1.5 h-1.5 rounded-full ${isActive ? 'bg-success animate-pulse' : 'bg-base-content/30'}`} />
    {isActive ? 'Active' : 'Inactive'}
  </span>
);

const MediaTypeBadge = ({ type }) => {
  const map = {
    image:  { icon: FileImage,   cls: 'bg-info/15 text-info border-info/30',    label: 'Image' },
    video:  { icon: MonitorPlay, cls: 'bg-accent/15 text-accent border-accent/30', label: 'Video' },
    lottie: { icon: Layers,      cls: 'bg-primary/15 text-primary border-primary/30', label: 'Lottie' },
  };
  const cfg = map[type] ?? map.image;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold border ${cfg.cls}`}>
      <Icon size={10} /> {cfg.label}
    </span>
  );
};

const ProgressBar = ({ value }) => (
  <div className="w-full h-2 bg-base-300 rounded-full overflow-hidden">
    <motion.div
      className="h-full bg-gradient-to-r from-primary to-secondary rounded-full"
      initial={{ width: 0 }}
      animate={{ width: `${value}%` }}
      transition={{ ease: 'easeOut' }}
    />
  </div>
);

const Skeleton = ({ className = '' }) => (
  <div className={`skeleton rounded-lg ${className}`} />
);

const EmptyState = ({ onAdd }) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="flex flex-col items-center justify-center py-24 text-center"
  >
    <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-6">
      <LayoutTemplate size={36} className="text-primary/60" />
    </div>
    <h3 className="text-xl font-black text-base-content mb-2">No hero pages yet</h3>
    <p className="text-base-content/50 text-sm mb-6 max-w-xs">
      Create your first hero section to start customizing your landing page experience.
    </p>
    <button onClick={onAdd} className="btn-primary-cta">
      <Plus size={16} className="mr-2" /> Create First Hero
    </button>
  </motion.div>
);

// ─────────────────────────────────────────────────────────────────────────────
// HERO FORM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const VARIANT_OPTIONS = ['primary', 'secondary', 'outline', 'ghost'];
const MEDIA_TYPES     = ['image', 'video', 'lottie'];

const defaultForm = {
  internalName: '',
  headline: '',
  highlightedText: '',
  subheadline: '',
  description: '',
  isActive: true,
  priority: 0,
  activeFrom: '',
  activeTo: '',
  analyticsTag: '',
  badge: null,
  ctaButtons: [],
  mediaUrl: '',
  mediaType: 'image',
  mediaAltText: '',
  seo: { metaTitle: '', metaDescription: '', ogImage: '' },
};

const HeroFormModal = ({ hero, onClose, onSaved }) => {
  const dispatch = useDispatch();
  const loadingCreate = useSelector(selectLoadingCreate);
  const loadingUpdate = useSelector(selectLoadingUpdate);
  const uploadProgress = useSelector(selectUploadProgress);
  const isEdit = Boolean(hero?._id);
  const isBusy = isEdit ? loadingUpdate : loadingCreate;

  const fileRef = useRef(null);
  const [form, setForm] = useState(defaultForm);
  const [file, setFile] = useState(null);
  const [filePreview, setFilePreview] = useState(null);
  const [tab, setTab] = useState('content');
  const [badgeEnabled, setBadgeEnabled] = useState(false);

  // Populate form when editing
  useEffect(() => {
    if (hero) {
      setForm({
        internalName:    hero.internalName    ?? '',
        headline:        hero.headline        ?? '',
        highlightedText: hero.highlightedText ?? '',
        subheadline:     hero.subheadline     ?? '',
        description:     hero.description     ?? '',
        isActive:        hero.isActive        ?? true,
        priority:        hero.priority        ?? 0,
        activeFrom:      hero.activeFrom ? hero.activeFrom.slice(0, 16) : '',
        activeTo:        hero.activeTo   ? hero.activeTo.slice(0, 16)   : '',
        analyticsTag:    hero.analyticsTag ?? '',
        badge:           hero.badge        ?? null,
        ctaButtons:      hero.ctaButtons   ?? [],
        mediaUrl:        hero.media?.url   ?? '',
        mediaType:       hero.media?.type  ?? 'image',
        mediaAltText:    hero.media?.altText ?? '',
        seo: {
          metaTitle:       hero.seo?.metaTitle       ?? '',
          metaDescription: hero.seo?.metaDescription ?? '',
          ogImage:         hero.seo?.ogImage         ?? '',
        },
      });
      if (hero.badge) setBadgeEnabled(true);
    }
  }, [hero]);

  const set = (key, val) => setForm((p) => ({ ...p, [key]: val }));
  const setSeo = (key, val) => setForm((p) => ({ ...p, seo: { ...p.seo, [key]: val } }));

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) setFilePreview(URL.createObjectURL(f));
    else setFilePreview(null);
  };

  // CTA button helpers
  const addCta = () =>
    set('ctaButtons', [...form.ctaButtons, { label: '', href: '', variant: 'primary', isExternal: false, order: form.ctaButtons.length }]);
  const updateCta = (i, key, val) => {
    const btns = [...form.ctaButtons];
    btns[i] = { ...btns[i], [key]: val };
    set('ctaButtons', btns);
  };
  const removeCta = (i) => set('ctaButtons', form.ctaButtons.filter((_, idx) => idx !== i));

  const handleSubmit = async (e) => {
    e.preventDefault();
    const fd = new FormData();

    // Scalar fields
    const scalarKeys = ['internalName','headline','highlightedText','subheadline','description',
      'analyticsTag','mediaUrl','mediaType','mediaAltText'];
    scalarKeys.forEach((k) => { if (form[k]) fd.append(k, form[k]); });

    fd.append('isActive',  String(form.isActive));
    fd.append('priority',  String(form.priority));
    if (form.activeFrom) fd.append('activeFrom', form.activeFrom);
    if (form.activeTo)   fd.append('activeTo',   form.activeTo);

    // Nested
    fd.append('ctaButtons', JSON.stringify(form.ctaButtons));
    fd.append('seo',        JSON.stringify(form.seo));
    if (badgeEnabled && form.badge) fd.append('badge', JSON.stringify(form.badge));

    // File
    if (file) fd.append('mediaFile', file);

    const action = isEdit
      ? dispatch(updateHeroPage({ id: hero._id, formData: fd }))
      : dispatch(createHeroPage({ formData: fd }));

    const result = await action;
    if (!result.error) {
      onSaved?.();
      onClose();
    }
  };

  const TABS = ['content', 'media', 'cta', 'seo', 'schedule'];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.92, y: 30 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.92, y: 30 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        className="card w-full max-w-3xl max-h-[92vh] overflow-hidden flex flex-col"
        style={{ background: 'var(--base-100)', border: '1px solid var(--base-300)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-base-300">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
              {isEdit ? <Edit3 size={16} className="text-primary" /> : <Plus size={16} className="text-primary" />}
            </div>
            <div>
              <h2 className="text-base font-black text-base-content">
                {isEdit ? 'Edit Hero Page' : 'New Hero Page'}
              </h2>
              {isEdit && (
                <p className="text-xs text-base-content/50 font-mono">{hero._id}</p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-base-300 transition-colors">
            <X size={16} className="text-base-content/60" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-4 pb-0 border-b border-base-300">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-xs font-bold uppercase tracking-wider rounded-t-lg transition-all capitalize ${
                tab === t
                  ? 'bg-primary text-primary-content'
                  : 'text-base-content/50 hover:text-base-content hover:bg-base-200'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

          {/* CONTENT TAB */}
          {tab === 'content' && (
            <motion.div key="content" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Internal Name <span className="text-error">*</span></label>
                  <input required value={form.internalName} onChange={(e) => set('internalName', e.target.value)} placeholder="e.g. homepage-hero-v3" className="input-field w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Headline <span className="text-error">*</span></label>
                  <input required value={form.headline} onChange={(e) => set('headline', e.target.value)} placeholder="Main hero headline" className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Highlighted Text</label>
                  <input value={form.highlightedText} onChange={(e) => set('highlightedText', e.target.value)} placeholder="Coloured part of headline" className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Analytics Tag</label>
                  <input value={form.analyticsTag} onChange={(e) => set('analyticsTag', e.target.value)} placeholder="e.g. hero_homepage_q1" className="input-field w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Subheadline</label>
                  <input value={form.subheadline} onChange={(e) => set('subheadline', e.target.value)} placeholder="Supporting headline" className="input-field w-full" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Description</label>
                  <textarea rows={3} value={form.description} onChange={(e) => set('description', e.target.value)} placeholder="Hero body text…" className="input-field w-full resize-none" />
                </div>
              </div>

              {/* Badge toggle */}
              <div className="rounded-xl border border-base-300 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-base-content/60 uppercase tracking-wider">Badge / Pill</label>
                  <button type="button" onClick={() => setBadgeEnabled(!badgeEnabled)} className="flex items-center gap-2 text-xs text-primary font-bold">
                    {badgeEnabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} className="text-base-content/40" />}
                    {badgeEnabled ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
                <AnimatePresence>
                  {badgeEnabled && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="grid grid-cols-3 gap-3 overflow-hidden">
                      <div className="col-span-2">
                        <input value={form.badge?.text ?? ''} onChange={(e) => set('badge', { ...form.badge, text: e.target.value })} placeholder="Badge text" className="input-field w-full" />
                      </div>
                      <input value={form.badge?.icon ?? ''} onChange={(e) => set('badge', { ...form.badge, icon: e.target.value })} placeholder="Icon / emoji" className="input-field w-full" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Status / Priority */}
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Priority</label>
                  <input type="number" value={form.priority} onChange={(e) => set('priority', Number(e.target.value))} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Status</label>
                  <button type="button" onClick={() => set('isActive', !form.isActive)} className={`w-full h-11 rounded-lg flex items-center justify-center gap-2 text-xs font-bold border transition-all ${form.isActive ? 'bg-success/15 border-success/30 text-success' : 'bg-base-300/40 border-base-300 text-base-content/50'}`}>
                    {form.isActive ? <><CheckCircle2 size={14} /> Active</> : <><EyeOff size={14} /> Inactive</>}
                  </button>
                </div>
              </div>
            </motion.div>
          )}

          {/* MEDIA TAB */}
          {tab === 'media' && (
            <motion.div key="media" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Media Type</label>
                <div className="flex gap-2">
                  {MEDIA_TYPES.map((t) => (
                    <button key={t} type="button" onClick={() => set('mediaType', t)} className={`flex-1 py-2 text-xs font-bold uppercase rounded-lg border transition-all ${form.mediaType === t ? 'bg-primary text-primary-content border-primary' : 'border-base-300 text-base-content/50 hover:border-primary/50'}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>

              {/* File upload zone */}
              <div
                className="relative rounded-xl border-2 border-dashed border-base-300 hover:border-primary/50 transition-colors cursor-pointer overflow-hidden"
                onClick={() => fileRef.current?.click()}
              >
                <input ref={fileRef} type="file" accept="image/*,video/*,application/json" onChange={handleFile} className="hidden" />
                <div className="flex flex-col items-center justify-center py-10 gap-3">
                  {filePreview ? (
                    <img src={filePreview} alt="Preview" className="max-h-40 rounded-lg object-cover" />
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                        <Upload size={20} className="text-primary/60" />
                      </div>
                      <div className="text-center">
                        <p className="text-sm font-bold text-base-content">{file ? file.name : 'Click to upload file'}</p>
                        <p className="text-xs text-base-content/40 mt-0.5">Images, video, Lottie JSON — max 10 MB</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {uploadProgress !== null && (
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs text-base-content/60">
                    <span>Uploading…</span><span>{uploadProgress}%</span>
                  </div>
                  <ProgressBar value={uploadProgress} />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Or enter URL directly</label>
                <input value={form.mediaUrl} onChange={(e) => set('mediaUrl', e.target.value)} placeholder="https://…" className="input-field w-full" />
              </div>
              <div>
                <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Alt Text</label>
                <input value={form.mediaAltText} onChange={(e) => set('mediaAltText', e.target.value)} placeholder="Describe the image for accessibility" className="input-field w-full" />
              </div>
            </motion.div>
          )}

          {/* CTA TAB */}
          {tab === 'cta' && (
            <motion.div key="cta" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-base-content/60 uppercase tracking-wider">CTA Buttons</p>
                <button type="button" onClick={addCta} className="flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 border border-primary/20 text-primary text-xs font-bold rounded-lg hover:bg-primary/20 transition-colors">
                  <Plus size={12} /> Add Button
                </button>
              </div>
              <AnimatePresence>
                {form.ctaButtons.map((btn, i) => (
                  <motion.div key={i} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="rounded-xl border border-base-300 p-4 space-y-3">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-bold text-base-content/50">Button {i + 1}</span>
                      <button type="button" onClick={() => removeCta(i)} className="text-error/70 hover:text-error"><X size={14} /></button>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <input value={btn.label} onChange={(e) => updateCta(i, 'label', e.target.value)} placeholder="Label" className="input-field w-full" />
                      <input value={btn.href} onChange={(e) => updateCta(i, 'href', e.target.value)} placeholder="href / URL" className="input-field w-full" />
                    </div>
                    <div className="flex gap-2">
                      {VARIANT_OPTIONS.map((v) => (
                        <button key={v} type="button" onClick={() => updateCta(i, 'variant', v)} className={`flex-1 py-1.5 text-xs font-bold capitalize rounded border transition-all ${btn.variant === v ? 'bg-primary text-primary-content border-primary' : 'border-base-300 text-base-content/50'}`}>
                          {v}
                        </button>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 text-xs text-base-content/60 cursor-pointer">
                      <input type="checkbox" checked={btn.isExternal} onChange={(e) => updateCta(i, 'isExternal', e.target.checked)} className="accent-primary" />
                      Open in new tab
                    </label>
                  </motion.div>
                ))}
              </AnimatePresence>
              {form.ctaButtons.length === 0 && (
                <div className="text-center py-10 text-base-content/30 text-sm">No buttons yet — add one above</div>
              )}
            </motion.div>
          )}

          {/* SEO TAB */}
          {tab === 'seo' && (
            <motion.div key="seo" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              {[
                { key: 'metaTitle', label: 'Meta Title', ph: 'Page title for search engines' },
                { key: 'metaDescription', label: 'Meta Description', ph: 'Brief description (150-160 chars)' },
                { key: 'ogImage', label: 'OG Image URL', ph: 'https://…' },
              ].map(({ key, label, ph }) => (
                <div key={key}>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">{label}</label>
                  <input value={form.seo[key]} onChange={(e) => setSeo(key, e.target.value)} placeholder={ph} className="input-field w-full" />
                </div>
              ))}
            </motion.div>
          )}

          {/* SCHEDULE TAB */}
          {tab === 'schedule' && (
            <motion.div key="schedule" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
              <div className="rounded-xl border border-warning/25 bg-warning/5 p-4 text-xs text-warning/80 flex gap-2">
                <Clock size={14} className="mt-0.5 shrink-0" />
                Set a date range to auto-activate and deactivate this hero. Leave blank for no restriction.
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Active From</label>
                  <input type="datetime-local" value={form.activeFrom} onChange={(e) => set('activeFrom', e.target.value)} className="input-field w-full" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-base-content/60 uppercase tracking-wider mb-1.5">Active Until</label>
                  <input type="datetime-local" value={form.activeTo} onChange={(e) => set('activeTo', e.target.value)} className="input-field w-full" />
                </div>
              </div>
            </motion.div>
          )}
        </form>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-base-300">
          <button type="button" onClick={onClose} className="px-5 py-2.5 text-sm font-bold text-base-content/60 hover:text-base-content rounded-lg hover:bg-base-200 transition-all">
            Cancel
          </button>
          <button onClick={handleSubmit} disabled={isBusy} className="btn-primary-cta flex items-center gap-2 disabled:opacity-60 disabled:pointer-events-none">
            {isBusy ? (
              <><span className="spinner w-4 h-4" /> {isEdit ? 'Saving…' : 'Creating…'}</>
            ) : (
              <>{isEdit ? <><Edit3 size={14} /> Save Changes</> : <><Plus size={14} /> Create Hero</>}</>
            )}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MEDIA REPLACE MODAL
// ─────────────────────────────────────────────────────────────────────────────

const MediaReplaceModal = ({ heroId, onClose }) => {
  const dispatch = useDispatch();
  const loadingMedia   = useSelector(selectLoadingMedia);
  const uploadProgress = useSelector(selectUploadProgress);
  const fileRef = useRef(null);
  const [file, setFile]       = useState(null);
  const [preview, setPreview] = useState(null);
  const [altText, setAltText] = useState('');

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!file) return;
    const fd = new FormData();
    fd.append('mediaFile', file);
    if (altText) fd.append('mediaAltText', altText);
    const result = await dispatch(replaceHeroMedia({ id: heroId, formData: fd }));
    if (!result.error) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.6)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
        className="card w-full max-w-md p-6 space-y-5"
        style={{ background: 'var(--base-100)' }}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-black text-base-content flex items-center gap-2"><ImageIcon size={16} className="text-primary" /> Replace Media</h3>
          <button onClick={onClose}><X size={16} className="text-base-content/50" /></button>
        </div>
        <div className="rounded-xl border-2 border-dashed border-base-300 hover:border-primary/50 transition-colors cursor-pointer p-8 text-center" onClick={() => fileRef.current?.click()}>
          <input ref={fileRef} type="file" accept="image/*,video/*,application/json" onChange={handleFile} className="hidden" />
          {preview ? (
            <img src={preview} className="max-h-32 mx-auto rounded-lg" alt="preview" />
          ) : (
            <><Upload size={24} className="mx-auto text-primary/40 mb-2" /><p className="text-sm text-base-content/50">{file ? file.name : 'Click to select file'}</p></>
          )}
        </div>
        {uploadProgress !== null && <ProgressBar value={uploadProgress} />}
        <input value={altText} onChange={(e) => setAltText(e.target.value)} placeholder="Alt text (accessibility)" className="input-field w-full" />
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold rounded-lg border border-base-300 hover:bg-base-200 transition-colors">Cancel</button>
          <button onClick={handleSubmit} disabled={!file || loadingMedia} className="flex-1 btn-primary-cta disabled:opacity-60">
            {loadingMedia ? 'Uploading…' : 'Replace Media'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// DELETE CONFIRM MODAL
// ─────────────────────────────────────────────────────────────────────────────

const DeleteConfirmModal = ({ hero, onClose }) => {
  const dispatch     = useDispatch();
  const loadingDelete = useSelector(selectLoadingDelete);

  const handleDelete = async () => {
    const result = await dispatch(deleteHeroPage(hero._id));
    if (!result.error) onClose();
  };

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
        className="card w-full max-w-sm p-6 text-center space-y-4"
        style={{ background: 'var(--base-100)' }}
      >
        <div className="w-16 h-16 rounded-2xl bg-error/15 border border-error/25 flex items-center justify-center mx-auto">
          <Trash2 size={24} className="text-error" />
        </div>
        <div>
          <h3 className="font-black text-base-content mb-1">Delete Hero Page?</h3>
          <p className="text-sm text-base-content/50">
            <span className="font-bold text-base-content">"{hero.internalName}"</span> will be permanently deleted. This cannot be undone.
          </p>
        </div>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm font-bold rounded-lg border border-base-300 hover:bg-base-200 transition-colors">Cancel</button>
          <button onClick={handleDelete} disabled={loadingDelete} className="flex-1 py-2.5 text-sm font-bold rounded-lg bg-error text-white hover:bg-error/90 transition-colors disabled:opacity-60">
            {loadingDelete ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// PRIORITY INLINE EDITOR
// ─────────────────────────────────────────────────────────────────────────────

const PriorityEditor = ({ hero }) => {
  const dispatch      = useDispatch();
  const loadingPriority = useSelector(selectLoadingPriority);
  const [editing, setEditing] = useState(false);
  const [val, setVal]         = useState(hero.priority);

  const save = async () => {
    if (Number(val) === hero.priority) { setEditing(false); return; }
    const result = await dispatch(updateHeroPriority({ id: hero._id, priority: Number(val) }));
    if (!result.error) setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          autoFocus type="number" value={val}
          onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && save()}
          onBlur={save}
          className="w-16 h-7 text-xs text-center input-field py-0 px-2"
        />
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      disabled={loadingPriority}
      className="flex items-center gap-1 px-2 py-1 rounded text-xs font-mono font-bold text-base-content/60 hover:bg-base-200 hover:text-primary transition-all"
      title="Click to edit priority"
    >
      <ArrowUpDown size={10} />
      {hero.priority}
    </button>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// HERO CARD ROW
// ─────────────────────────────────────────────────────────────────────────────

const HeroRow = ({ hero, onEdit, onDelete, onReplaceMedia }) => {
  const dispatch     = useDispatch();
  const loadingToggle = useSelector(selectLoadingToggle);

  const handleToggle = () => dispatch(toggleHeroPage(hero._id));

  return (
    <motion.tr
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="border-b border-base-300/50 hover:bg-base-200/40 transition-colors group"
    >
      {/* Media thumb */}
      <td className="px-4 py-3 w-14">
        <div className="w-10 h-10 rounded-lg overflow-hidden bg-base-300 border border-base-300 flex items-center justify-center shrink-0">
          {hero.media?.url && hero.media?.type === 'image' ? (
            <img src={hero.media.url} alt={hero.media.altText} className="w-full h-full object-cover" />
          ) : hero.media?.type === 'video' ? (
            <MonitorPlay size={16} className="text-base-content/40" />
          ) : (
            <ImageIcon size={14} className="text-base-content/30" />
          )}
        </div>
      </td>

      {/* Name / headline */}
      <td className="px-2 py-3">
        <p className="text-sm font-bold text-base-content leading-tight truncate max-w-[160px]">{hero.internalName}</p>
        <p className="text-xs text-base-content/40 truncate max-w-[160px]">{hero.headline}</p>
      </td>

      {/* Status */}
      <td className="px-2 py-3 hidden md:table-cell">
        <StatusBadge isActive={hero.isActive} />
      </td>

      {/* Media type */}
      <td className="px-2 py-3 hidden lg:table-cell">
        {hero.media ? <MediaTypeBadge type={hero.media.type} /> : <span className="text-xs text-base-content/30">—</span>}
      </td>

      {/* Priority */}
      <td className="px-2 py-3 hidden md:table-cell">
        <PriorityEditor hero={hero} />
      </td>

      {/* CTA count */}
      <td className="px-2 py-3 hidden lg:table-cell">
        <span className="text-xs text-base-content/50 font-mono">{hero.ctaButtons?.length ?? 0} btn{hero.ctaButtons?.length !== 1 ? 's' : ''}</span>
      </td>

      {/* Toggle */}
      <td className="px-2 py-3">
        <button
          onClick={handleToggle}
          disabled={loadingToggle}
          className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${hero.isActive ? 'text-success hover:bg-success/10' : 'text-base-content/30 hover:bg-base-300'}`}
          title={hero.isActive ? 'Deactivate' : 'Activate'}
        >
          {hero.isActive ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
        </button>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={() => onReplaceMedia(hero)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-info/10 text-info/70 hover:text-info transition-all" title="Replace media">
            <ImageIcon size={13} />
          </button>
          <button onClick={() => onEdit(hero)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-primary/10 text-primary/70 hover:text-primary transition-all" title="Edit">
            <Edit3 size={13} />
          </button>
          <button onClick={() => onDelete(hero)} className="w-7 h-7 rounded flex items-center justify-center hover:bg-error/10 text-error/60 hover:text-error transition-all" title="Delete">
            <Trash2 size={13} />
          </button>
        </div>
      </td>
    </motion.tr>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────

export default function HeroPageManagement() {
  const dispatch   = useDispatch();
  const heroes     = useSelector(selectHeroes);
  const pagination = useSelector(selectHeroPagination);
  const error      = useSelector(selectHeroError);
  const loadingList = useSelector(selectLoadingList);
  const anyLoading  = useSelector(selectAnyHeroLoading);

  const [query, setQuery]       = useState({ page: 1, limit: 10, search: '', isActive: '' });
  const [modal, setModal]       = useState(null); // 'create' | 'edit' | 'media' | 'delete'
  const [target, setTarget]     = useState(null); // hero being acted on

  const load = useCallback(() => {
    const params = { page: query.page, limit: query.limit };
    if (query.search)   params.search   = query.search;
    if (query.isActive) params.isActive = query.isActive;
    dispatch(fetchHeroPages(params));
  }, [dispatch, query]);

  useEffect(() => { load(); }, [load]);

  const openCreate      = ()       => { setTarget(null); setModal('create'); };
  const openEdit        = (hero)   => { dispatch(fetchHeroPageById(hero._id)); setTarget(hero); setModal('edit'); };
  const openDelete      = (hero)   => { setTarget(hero); setModal('delete'); };
  const openReplaceMedia = (hero)  => { setTarget(hero); setModal('media'); };
  const closeModal      = ()       => { setModal(null); setTarget(null); dispatch(clearSelectedHero()); dispatch(clearError()); };

  const selectedHero = useSelector(selectSelectedHero);

  return (
    <div className="min-h-screen" style={{ background: 'var(--base-100)' }}>
      <div className="container-custom py-8 max-w-7xl">

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/20 border border-primary/20 flex items-center justify-center">
                <LayoutTemplate size={17} className="text-primary" />
              </div>
              <h1 className="text-2xl font-black text-base-content tracking-tight">Hero Pages</h1>
              <span className="badge badge-primary ml-1">{pagination.total} total</span>
            </div>
            <p className="text-sm text-base-content/50 ml-12">Manage landing page hero sections — active, scheduled, and archived.</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={load} disabled={anyLoading} className="w-9 h-9 rounded-lg border border-base-300 flex items-center justify-center hover:bg-base-200 transition-all disabled:opacity-50" title="Refresh">
              <RefreshCw size={14} className={`text-base-content/60 ${anyLoading ? 'animate-spin' : ''}`} />
            </button>
            <button onClick={openCreate} className="btn-primary-cta flex items-center gap-2">
              <Plus size={15} /> New Hero
            </button>
          </div>
        </motion.div>

        {/* Filters */}
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass-card p-4 mb-6 flex flex-col sm:flex-row gap-3">
          <div className="flex-1 relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" />
            <input
              value={query.search}
              onChange={(e) => setQuery((p) => ({ ...p, search: e.target.value, page: 1 }))}
              placeholder="Search by name or headline…"
              className="input-field w-full pl-9"
            />
          </div>
          <div className="flex gap-2">
            <select value={query.isActive} onChange={(e) => setQuery((p) => ({ ...p, isActive: e.target.value, page: 1 }))} className="input-field pr-8" style={{ minWidth: 120 }}>
              <option value="">All Status</option>
              <option value="true">Active</option>
              <option value="false">Inactive</option>
            </select>
            <select value={query.limit} onChange={(e) => setQuery((p) => ({ ...p, limit: Number(e.target.value), page: 1 }))} className="input-field pr-8">
              {[5, 10, 25, 50].map((n) => <option key={n} value={n}>{n} / page</option>)}
            </select>
          </div>
        </motion.div>

        {/* Error banner */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="alert alert-error mb-6 flex items-center gap-2">
              <AlertCircle size={16} className="text-error" />
              <span className="text-sm flex-1">{error}</span>
              <button onClick={() => dispatch(clearError())}><X size={14} /></button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Table */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="glass-card overflow-hidden">
          {loadingList ? (
            <div className="p-6 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="w-10 h-10 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-3 w-2/5" />
                    <Skeleton className="h-2 w-3/5" />
                  </div>
                  <Skeleton className="h-6 w-16" />
                </div>
              ))}
            </div>
          ) : heroes.length === 0 ? (
            <EmptyState onAdd={openCreate} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-base-300 bg-base-200/50">
                    <th className="px-4 py-3 text-left w-14" />
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider">Name / Headline</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden md:table-cell">Status</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden lg:table-cell">Media</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden md:table-cell">Priority</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider hidden lg:table-cell">CTAs</th>
                    <th className="px-2 py-3 text-left text-xs font-bold text-base-content/50 uppercase tracking-wider">Toggle</th>
                    <th className="px-4 py-3 text-right text-xs font-bold text-base-content/50 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  <AnimatePresence>
                    {heroes.map((hero) => (
                      <HeroRow
                        key={hero._id}
                        hero={hero}
                        onEdit={openEdit}
                        onDelete={openDelete}
                        onReplaceMedia={openReplaceMedia}
                      />
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 border-t border-base-300">
              <p className="text-xs text-base-content/50">
                Page <span className="font-bold text-base-content">{pagination.page}</span> of{' '}
                <span className="font-bold text-base-content">{pagination.pages}</span> —{' '}
                <span className="font-bold text-base-content">{pagination.total}</span> results
              </p>
              <div className="flex items-center gap-2">
                <button
                  disabled={query.page <= 1}
                  onClick={() => setQuery((p) => ({ ...p, page: p.page - 1 }))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-base-300 hover:bg-base-200 transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronLeft size={14} />
                </button>
                {Array.from({ length: Math.min(5, pagination.pages) }, (_, i) => {
                  const page = i + 1;
                  return (
                    <button
                      key={page}
                      onClick={() => setQuery((p) => ({ ...p, page }))}
                      className={`w-8 h-8 rounded-lg text-xs font-bold transition-all ${query.page === page ? 'bg-primary text-primary-content' : 'border border-base-300 hover:bg-base-200'}`}
                    >
                      {page}
                    </button>
                  );
                })}
                <button
                  disabled={query.page >= pagination.pages}
                  onClick={() => setQuery((p) => ({ ...p, page: p.page + 1 }))}
                  className="w-8 h-8 rounded-lg flex items-center justify-center border border-base-300 hover:bg-base-200 transition-all disabled:opacity-40 disabled:pointer-events-none"
                >
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {(modal === 'create') && (
          <HeroFormModal key="create-modal" hero={null} onClose={closeModal} onSaved={load} />
        )}
        {(modal === 'edit' && (selectedHero || target)) && (
          <HeroFormModal key="edit-modal" hero={selectedHero ?? target} onClose={closeModal} onSaved={load} />
        )}
        {(modal === 'media' && target) && (
          <MediaReplaceModal key="media-modal" heroId={target._id} onClose={closeModal} />
        )}
        {(modal === 'delete' && target) && (
          <DeleteConfirmModal key="delete-modal" hero={target} onClose={closeModal} />
        )}
      </AnimatePresence>
    </div>
  );
}