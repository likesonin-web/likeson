"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, TrendingUp, MousePointer2, Eye, 
  Trash2, Edit3, X, Layers, Activity,
  Upload, Navigation, Layout
} from 'lucide-react';

// Thunks
import { 
  fetchAllBanners, createBanner, updateBanner, deleteBanner 
} from '@/store/slices/bannerSlice';
import { uploadSingleFile } from '@/store/slices/uploadSlice';

const BannerManagement = () => {
  const dispatch = useDispatch();
  const { adminBanners, loading } = useSelector((state) => state.banners);
  const { isUploading, lastUploadedUrl } = useSelector((state) => state.upload);
  const { user } = useSelector((state) => state.user);

  // UI State
  const [searchTerm, setSearchTerm] = useState('');
  const [filters, setFilters] = useState({ position: 'all', status: 'all' });
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isEditMode, setIsEditMode] = useState(false);

  // Initial Form State matching Banner Schema
  const initialForm = {
    title: '',
    subTitle: '',
    imageUrl: '',
    targetType: 'InternalRoute',
    targetId: '',
    externalUrl: '',
    position: 'Home_Top',
    priority: 0,
    isActive: true,
    startDate: new Date().toISOString().split('T')[0],
    endDate: '',
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    dispatch(fetchAllBanners());
  }, [dispatch]);

  // Sync uploaded URL
  useEffect(() => {
    if (lastUploadedUrl) {
      setFormData(prev => ({ ...prev, imageUrl: lastUploadedUrl }));
    }
  }, [lastUploadedUrl]);

  const filteredBanners = useMemo(() => {
    return adminBanners.filter(banner => {
      const matchesSearch = banner.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesPos = filters.position === 'all' || banner.position === filters.position;
      const matchesStatus = filters.status === 'all' || 
                            (filters.status === 'Active' ? banner.isActive : !banner.isActive);
      return matchesSearch && matchesPos && matchesStatus;
    });
  }, [adminBanners, searchTerm, filters]);

  const handleEditClick = (banner) => {
    setFormData({
      ...banner,
      startDate: banner.startDate ? new Date(banner.startDate).toISOString().split('T')[0] : '',
      endDate: banner.endDate ? new Date(banner.endDate).toISOString().split('T')[0] : '',
    });
    setIsEditMode(true);
    setIsSidebarOpen(true);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isEditMode) {
      dispatch(updateBanner({ id: formData._id, bannerData: formData }));
    } else {
      dispatch(createBanner({ ...formData, createdBy: user?._id }));
    }
    setIsSidebarOpen(false);
    setIsEditMode(false);
    setFormData(initialForm);
  };

  // Stats Configuration with Chart Colors
 // Stats Configuration with Chart Colors
  const stats = [
    { 
      label: 'Total Views', 
      val: adminBanners.reduce((acc, b) => acc + (b.analytics?.views || 0), 0), 
      icon: Eye, 
      color: 'var(--color-chart-1)', // Blue
      bg: 'oklch(from var(--color-chart-1) l c h / 0.1)', // Light tint for bg
      animType: 'float' 
    },
    { 
      label: 'Total Clicks', 
      val: adminBanners.reduce((acc, b) => acc + (b.analytics?.clicks || 0), 0), 
      icon: MousePointer2, 
      color: 'var(--color-chart-2)', // Teal
      bg: 'oklch(from var(--color-chart-2) l c h / 0.1)',
      animType: 'pulse' 
    },
    { 
      label: 'Avg CTR', 
      val: '4.2%', 
      icon: TrendingUp, 
      color: 'var(--color-chart-3)', // Orange
      bg: 'oklch(from var(--color-chart-3) l c h / 0.1)',
      animType: 'float' 
    },
    { 
      label: 'Engagement', 
      val: '12.8%', 
      icon: Activity, 
      color: 'var(--color-chart-5)', // Purple
      bg: 'oklch(from var(--color-chart-5) l c h / 0.1)',
      animType: 'pulse' 
    },
  ];

  return (
    <div className="min-h-screen p-6 space-y-10 max-w-[1600px] mx-auto relative">
      
     {/* --- BACKGROUND AMBIENCE --- */}
      <div className="absolute top-0 left-0 w-full h-[600px] overflow-hidden -z-10 pointer-events-none">
        <motion.div 
          animate={{ scale: [1, 1.2, 1], opacity: [0.08, 0.15, 0.08] }}
          transition={{ duration: 10, repeat: Infinity }}
          className="absolute -top-24 -left-24 w-96 h-96 bg-primary rounded-full blur-[100px]"
        />
        <motion.div 
          animate={{ scale: [1, 1.3, 1], opacity: [0.05, 0.12, 0.05] }}
          transition={{ duration: 15, repeat: Infinity, delay: 2 }}
          className="absolute top-0 right-0 w-[500px] h-[500px] rounded-full blur-[120px]"
          style={{ backgroundColor: 'var(--color-chart-2)' }}
        />
      </div>

      {/* --- 1. TOP ANALYTICS SECTION --- */}
      <section className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center justify-between border-b-4 relative group overflow-hidden"
            style={{ borderBottomColor: stat.color }}
          >
            {/* Content */}
            <div className="relative z-10">
              <p className="text-[10px] font-black uppercase opacity-60 mb-1 tracking-widest">{stat.label}</p>
              <h3 className="text-3xl font-black">{stat.val}</h3>
            </div>

            {/* Icon with Looping Animation */}
            <motion.div
              animate={stat.animType === 'float' ? { y: [0, -8, 0] } : { scale: [1, 1.15, 1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="p-4 rounded-2xl shadow-inner border border-base-300 z-10"
              style={{ 
                color: stat.color, 
                backgroundColor: 'var(--base-200)'
              }}
            >
              <stat.icon size={28} strokeWidth={2.5} />
            </motion.div>

            {/* Hover Glow Effect */}
            <div 
              className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none"
              style={{ background: `radial-gradient(circle at 70% 50%, ${stat.color}, transparent)` }}
            />
          </motion.div>
        ))}
      </section>

      {/* --- 2. SEARCH & DUAL FILTERS --- */}
      <div className="flex flex-wrap items-center gap-4 glass-card p-4 sticky top-4 z-40 bg-base-100/80 backdrop-blur-md">
        <div className="flex-1 min-w-[300px] relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
          <input 
            type="text" 
            placeholder="Search banners..." 
            className="input-field w-full pl-12" 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
        <div className="flex gap-3">
          <select className="input-field" onChange={(e) => setFilters({...filters, position: e.target.value})}>
            <option value="all">All Positions</option>
            <option value="Home_Top">Home Top</option>
            <option value="Medicine_Page">Medicine Page</option>
            <option value="Lab_Page">Lab Page</option>
          </select>
          <select className="input-field" onChange={(e) => setFilters({...filters, status: e.target.value})}>
            <option value="all">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
        <button 
          onClick={() => { setIsEditMode(false); setFormData(initialForm); setIsSidebarOpen(true); }} 
          className="btn-primary-cta flex items-center gap-2"
        >
          <Plus size={20} /> Add Banner
        </button>
      </div>

      {/* --- 3. BANNER GRID --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence mode='popLayout'>
          {filteredBanners.map((banner) => (
            <motion.div 
              layout 
              key={banner._id} 
              initial={{ opacity: 0, scale: 0.9 }} 
              animate={{ opacity: 1, scale: 1 }} 
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card group overflow-hidden flex flex-col h-full    "
            >
              <div className="relative aspect-[21/9] bg-neutral/10 overflow-hidden">
                <img 
                  src={banner.imageUrl} 
                  alt={banner.title}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                />
                <div className="absolute top-2 right-2 flex gap-2">
                   <span className={`text-[10px] font-bold px-2 py-1 rounded shadow-sm ${banner.isActive ? 'bg-success/20 text-success' : 'bg-error/20 text-error'}`}>
                     {banner.isActive ? 'ACTIVE' : 'INACTIVE'}
                   </span>
                </div>
              </div>
              <div className="p-5 flex-1 flex flex-col">
                <h4 className="font-black text-lg line-clamp-1">{banner.title}</h4>
                <p className="text-xs opacity-50 mb-4">{banner.position} • Priority: {banner.priority}</p>
                <div className="mt-auto pt-4 border-t border-base-300 flex justify-between">
                  <div className="flex gap-4 text-xs font-mono">
                    <span className="flex items-center gap-1 text-[var(--chart-1)]"><Eye size={12}/> {banner.analytics?.views}</span>
                    <span className="flex items-center gap-1 text-[var(--chart-2)]"><MousePointer2 size={12}/> {banner.analytics?.clicks}</span>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => handleEditClick(banner)} className="p-2 hover:bg-primary/10 rounded-lg text-primary transition-colors"><Edit3 size={16}/></button>
                    <button onClick={() => dispatch(deleteBanner(banner._id))} className="p-2 hover:bg-error/10 rounded-lg text-error transition-colors"><Trash2 size={16}/></button>
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* --- 4. SIDEBAR FORM --- */}
      <AnimatePresence>
        {isSidebarOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSidebarOpen(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" 
            />
            <motion.div 
              initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} 
              transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
              className="fixed inset-y-0 right-0 w-full max-w-2xl bg-base-100 shadow-3xl z-[110] border-l border-base-300 flex flex-col"
            >
              <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-200/50">
                <h2 className="text-2xl font-black tracking-tighter">{isEditMode ? 'Update' : 'Create'} Banner</h2>
                <button onClick={() => setIsSidebarOpen(false)} className="hover:rotate-90 transition-transform"><X/></button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 overflow-y-auto flex-1 space-y-8 custom-scrollbar">
                
                <section className="space-y-4">
                  <h4 className="font-black text-primary flex items-center gap-2 text-sm uppercase tracking-widest"><Layers size={18}/> 1. Visuals</h4>
                  <AnimatePresence>
                    {formData.imageUrl && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="relative aspect-[21/9] rounded-2xl overflow-hidden bg-base-200 border border-base-300 group">
                        <img src={formData.imageUrl} className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setFormData({...formData, imageUrl: ''})} className="absolute top-3 right-3 p-2 bg-error text-white rounded-full"><X size={18}/></button>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  <div className="grid grid-cols-1 gap-4">
                    <input required placeholder="Banner Title" className="input-field" value={formData.title} onChange={e => setFormData({...formData, title: e.target.value})} />
                    <input placeholder="Subtitle (Optional)" className="input-field" value={formData.subTitle} onChange={e => setFormData({...formData, subTitle: e.target.value})} />
                    <div className="flex gap-2">
                      <input placeholder="Image URL" className="input-field flex-1" value={formData.imageUrl} onChange={e => setFormData({...formData, imageUrl: e.target.value})} />
                      <label className="p-3 bg-primary/10 text-primary rounded-xl cursor-pointer hover:bg-primary hover:text-white flex items-center transition-all">
                        {isUploading ? <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" /> : <Upload size={20} />}
                        <input type="file" hidden onChange={(e) => dispatch(uploadSingleFile({ file: e.target.files[0], folder: 'banners' }))} />
                      </label>
                    </div>
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="font-black text-primary flex items-center gap-2 text-sm uppercase tracking-widest"><Navigation size={18}/> 2. Navigation</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <select className="input-field" value={formData.targetType} onChange={e => setFormData({...formData, targetType: e.target.value})}>
                      <option value="InternalRoute">Internal Route</option>
                      <option value="ExternalLink">External Link</option>
                      <option value="Product">Product Page</option>
                      <option value="Category">Category</option>
                    </select>
                    {formData.targetType === 'ExternalLink' ? (
                      <input placeholder="https://..." className="input-field" value={formData.externalUrl} onChange={e => setFormData({...formData, externalUrl: e.target.value})} />
                    ) : (
                      <input placeholder="ID / Slug" className="input-field" value={formData.targetId} onChange={e => setFormData({...formData, targetId: e.target.value})} />
                    )}
                  </div>
                </section>

                <section className="space-y-4">
                  <h4 className="font-black text-primary flex items-center gap-2 text-sm uppercase tracking-widest"><Layout size={18}/> 3. Logic & Timing</h4>
                  <div className="grid grid-cols-2 gap-4">
                    <select className="input-field" value={formData.position} onChange={e => setFormData({...formData, position: e.target.value})}>
                      <option value="Home_Top">Home Top</option>
                      <option value="Home_Middle">Home Middle</option>
                      <option value="Medicine_Page">Medicine Page</option>
                      <option value="Lab_Page">Lab Page</option>
                    </select>
                    <input type="number" placeholder="Priority" className="input-field" value={formData.priority} onChange={e => setFormData({...formData, priority: Number(e.target.value)})} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <input type="date" className="input-field" value={formData.startDate} onChange={e => setFormData({...formData, startDate: e.target.value})} />
                    <input type="date" className="input-field" value={formData.endDate} onChange={e => setFormData({...formData, endDate: e.target.value})} />
                  </div>
                  <div 
                    className="flex items-center justify-between p-4 rounded-xl border-2 transition-colors cursor-pointer"
                    style={{ borderColor: formData.isActive ? 'var(--success)' : 'var(--base-300)' }}
                    onClick={() => setFormData({...formData, isActive: !formData.isActive})}
                  >
                     <span className="font-black uppercase text-xs tracking-widest">Status: {formData.isActive ? 'Active' : 'Draft'}</span>
                     <div className={`w-12 h-6 rounded-full relative transition-colors ${formData.isActive ? 'bg-success' : 'bg-base-300'}`}>
                        <motion.div 
                          animate={{ x: formData.isActive ? 24 : 4 }}
                          className="absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm"
                        />
                     </div>
                  </div>
                </section>

                <button 
                  type="submit" 
                  disabled={isUploading || loading} 
                  className="btn-primary-cta w-full py-5 text-xl shadow-2xl disabled:opacity-50"
                >
                  {isEditMode ? 'Update Live' : 'Publish Banner'}
                </button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default BannerManagement;