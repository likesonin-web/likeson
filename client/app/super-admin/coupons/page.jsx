"use client";

import React, { useEffect, useState, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { 
  Plus, Search, Ticket, Activity, Trash2, Edit3, 
  Percent, DollarSign, X, LayoutGrid, List, 
  Calendar, Users, ShieldCheck, Clock
} from 'lucide-react';
import { 
  fetchCoupons, createCoupon, updateCouponStatus, 
  deleteCoupon, selectAllCoupons, selectPromotionLoading 
} from '@/store/slices/promotionSlice';

// Snappy transition constants
const fastTransition = { type: "tween", ease: "circOut", duration: 0.2 };
const springQuick = { type: "spring", stiffness: 500, damping: 40, mass: 1 };

/**
 * @section MASTER COMPONENT: PROMOTION & COUPON MANAGEMENT
 * Performance Optimized for Likeson Healthcare Services
 */
const PromotionCouponManagement = () => {
  const dispatch = useDispatch();
  const coupons = useSelector(selectAllCoupons);
  const loading = useSelector(selectPromotionLoading);
  
  // UI States
  const [viewMode, setViewMode] = useState('grid'); // 'grid' | 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState(null);

  // Form State
  const [formData, setFormData] = useState({
    code: '',
    eligibility: { type: 'General', minOrderValue: 0 },
    benefit: { type: 'Percentage', value: 0, maxCap: 0 },
    usage: { limitPerUser: 1, totalPlatformLimit: 100 },
    validity: { from: '', to: '' },
    isActive: true
  });

  useEffect(() => {
    dispatch(fetchCoupons());
  }, [dispatch]);

  /** * @section LOGIC HANDLERS */
  const handleOpenModal = (coupon = null) => {
    if (coupon) {
      setEditingCoupon(coupon);
      setFormData({
        ...coupon,
        validity: {
          from: new Date(coupon.validity.from).toISOString().split('T')[0],
          to: new Date(coupon.validity.to).toISOString().split('T')[0]
        }
      });
    } else {
      setEditingCoupon(null);
      setFormData({
        code: '',
        eligibility: { type: 'General', minOrderValue: 0 },
        benefit: { type: 'Percentage', value: 0, maxCap: 0 },
        usage: { limitPerUser: 1, totalPlatformLimit: 100 },
        validity: { from: '', to: '' },
        isActive: true
      });
    }
    setIsModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingCoupon) {
      // Dispatch update action here
    } else {
      await dispatch(createCoupon(formData));
    }
    setIsModalOpen(false);
  };

  const filteredItems = useMemo(() => {
    return coupons.filter(c => 
      c.code.toLowerCase().includes(searchTerm.toLowerCase()) &&
      (filterStatus === 'All' ? true : filterStatus === 'Active' ? c.isActive : !c.isActive)
    );
  }, [coupons, searchTerm, filterStatus]);

  return (
    <div className="container-custom py-10 min-h-screen">
      
      {/* --- HEADER SECTION --- */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6 mb-12">
        <motion.div 
          initial={{ opacity: 0, y: 10 }} 
          animate={{ opacity: 1, y: 0 }}
          transition={fastTransition}
        >
         
          <h1 className="section-heading !mb-1">Promotion <span className="text-gradient-primary">Coupons</span></h1>
          <p className="section-subheading !mb-0 text-balance">
            Manage subsidies, healthcare discounts, and promotional growth loops.
          </p>
        </motion.div>

        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => handleOpenModal()} 
          className="btn-primary-cta flex items-center gap-2 group"
        >
          <Plus size={20} className="group-hover:rotate-90 transition-transform duration-200" /> 
          Create Promotion
        </motion.button>
      </header>

      {/* --- QUICK ANALYTICS STRIP --- */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {[
          { label: 'Active Codes', val: coupons.filter(c => c.isActive).length, icon: Ticket, color: 'text-primary' },
          { label: 'Redemptions', val: '1.2k', icon: Activity, color: 'text-success' },
          { label: 'Avg. Discount', val: '18%', icon: Percent, color: 'text-info' },
          { label: 'Total Savings', val: '$4.5k', icon: DollarSign, color: 'text-accent' },
        ].map((stat, i) => (
          <motion.div 
            key={i} 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ ...fastTransition, delay: i * 0.05 }}
            className="glass-card p-4 flex items-center gap-4"
          >
            <div className={`p-3 rounded-xl bg-base-200 ${stat.color}`}><stat.icon size={20}/></div>
            <div>
              <p className="text-[10px] font-black uppercase opacity-50 tracking-tighter">{stat.label}</p>
              <p className="text-xl font-black">{stat.val}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* --- SEARCH & VIEW TOGGLE BAR --- */}
      <div className="glass-card p-2 mb-8 flex flex-wrap gap-4 items-center justify-between">
        <div className="flex flex-1 items-center gap-4 min-w-[300px]">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30 group-focus-within:text-primary transition-colors" size={18} />
            <input 
              className="input-field w-full pl-12 bg-transparent border-none focus:ring-0" 
              placeholder="Search by coupon code (e.g. LIFELINE20)..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="h-8 w-px bg-base-300 hidden md:block" />
          <select 
            className="bg-transparent text-sm font-bold outline-none cursor-pointer pr-4"
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
          >
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Paused">Paused</option>
          </select>
        </div>

        <div className="flex items-center gap-1 bg-base-200 p-1 rounded-lg">
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'grid' ? 'bg-white shadow-sm text-primary' : 'opacity-40 hover:opacity-100'}`}
          >
            <LayoutGrid size={18}/>
          </button>
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all duration-200 ${viewMode === 'list' ? 'bg-white shadow-sm text-primary' : 'opacity-40 hover:opacity-100'}`}
          >
            <List size={18}/>
          </button>
        </div>
      </div>

      {/* --- CONTENT AREA: GRID OR LIST --- */}
      <LayoutGroup>
        <motion.div 
          layout
          className={viewMode === 'grid' ? "grid-responsive" : "flex flex-col gap-3"}
        >
          <AnimatePresence mode='popLayout'>
            {filteredItems.map((coupon) => (
              <motion.div
                layout
                key={coupon._id}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98, transition: { duration: 0.1 } }}
                transition={springQuick}
                className={`glass-card group relative overflow-hidden ${viewMode === 'grid' ? 'p-6 border-t-4' : 'p-4 flex items-center justify-between'}`}
                style={viewMode === 'grid' ? { borderTopColor: coupon.isActive ? 'var(--success)' : 'var(--error)' } : {}}
              >
                {viewMode === 'grid' ? (
                  <>
                    <div className="flex justify-between items-start mb-6">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <Ticket size={14} className="text-primary"/>
                          <span className="text-[10px] font-black uppercase opacity-40">Promo Code</span>
                        </div>
                        <div className="text-xl font-black tracking-tighter text-primary uppercase">
                          {coupon.code}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-200 transform translate-y-[-5px] group-hover:translate-y-0">
                        <button onClick={() => handleOpenModal(coupon)} className="p-2 hover:bg-primary/10 text-primary rounded-lg transition-colors"><Edit3 size={16}/></button>
                        <button onClick={() => dispatch(deleteCoupon(coupon._id))} className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="p-3 bg-base-200/50 rounded-xl">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="opacity-50 font-bold uppercase tracking-widest">Benefit</span>
                          <span className="text-success font-black">
                            {coupon.benefit.type === 'Percentage' ? `${coupon.benefit.value}% OFF` : `$${coupon.benefit.value} Flat`}
                          </span>
                        </div>
                        <div className="w-full bg-base-300 h-1.5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(coupon.usage.currentUses / coupon.usage.totalPlatformLimit) * 100}%` }}
                            transition={{ duration: 0.5, ease: "easeOut" }}
                            className="h-full bg-primary"
                          />
                        </div>
                        <div className="flex justify-between mt-2 text-[10px] font-bold">
                          <span className="opacity-40 uppercase">Redeemed</span>
                          <span>{coupon.usage.currentUses} / {coupon.usage.totalPlatformLimit}</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[10px] font-bold uppercase tracking-tight">
                        <div className="flex items-center gap-2 opacity-60"><Users size={12}/> {coupon.eligibility.type}</div>
                        <div className="flex items-center gap-2 opacity-60"><Clock size={12}/> Ends {new Date(coupon.validity.to).toLocaleDateString()}</div>
                      </div>
                    </div>

                    <button 
                      onClick={() => dispatch(updateCouponStatus({ id: coupon._id, isActive: !coupon.isActive }))}
                      className={`w-full py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all duration-200 ${
                        coupon.isActive ? 'bg-success/10 text-success hover:bg-success hover:text-white' : 'bg-error/10 text-error hover:bg-error hover:text-white'
                      }`}
                    >
                      {coupon.isActive ? 'Active - Click to Pause' : 'Paused - Click to Resume'}
                    </button>
                  </>
                ) : (
                  <>
                    <div className="flex items-center gap-6 flex-1">
                      <div className={`p-3 rounded-lg ${coupon.isActive ? 'bg-success/10 text-success' : 'bg-error/10 text-error'}`}>
                        <Ticket size={20}/>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-xs font-black opacity-30 uppercase">Code</p>
                        <p className="font-bold text-primary">{coupon.code}</p>
                      </div>
                      <div className="min-w-[120px]">
                        <p className="text-xs font-black opacity-30 uppercase">Benefit</p>
                        <p className="font-bold">{coupon.benefit.type === 'Percentage' ? `${coupon.benefit.value}%` : `$${coupon.benefit.value}`}</p>
                      </div>
                      <div className="hidden md:block min-w-[150px]">
                        <p className="text-xs font-black opacity-30 uppercase">Usage</p>
                        <p className="text-sm font-medium">{coupon.usage.currentUses} of {coupon.usage.totalPlatformLimit}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className={`badge ${coupon.isActive ? 'badge-success' : 'badge-error'}`}>
                        {coupon.isActive ? 'Active' : 'Paused'}
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => handleOpenModal(coupon)} className="p-2 hover:bg-base-200 rounded-lg transition-colors"><Edit3 size={16}/></button>
                        <button onClick={() => dispatch(deleteCoupon(coupon._id))} className="p-2 hover:bg-error/10 text-error rounded-lg transition-colors"><Trash2 size={16}/></button>
                      </div>
                    </div>
                  </>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </motion.div>
      </LayoutGroup>

      {/* --- MASTER CREATION MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
            />
            
            <motion.div 
              initial={{ y: 20, opacity: 0, scale: 0.98 }} 
              animate={{ y: 0, opacity: 1, scale: 1 }} 
              exit={{ y: 10, opacity: 0, scale: 0.98 }}
              transition={fastTransition}
              className="glass-card w-full max-w-2xl relative z-10 overflow-hidden shadow-2xl !border-none"
            >
              {/* Modal Header */}
              <div className="p-6 bg-gradient-to-r from-primary to-secondary text-white flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-white/20 rounded-lg backdrop-blur-md"><Ticket size={24}/></div>
                  <div>
                    <h2 className="text-xl font-black uppercase tracking-tight">
                      {editingCoupon ? 'Modify Campaign' : 'New Promotion'}
                    </h2>
                    <p className="text-[10px] opacity-70 font-bold uppercase tracking-[0.2em]">Make valuable Coupon  </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="hover:rotate-90 transition-transform duration-200 p-2 hover:bg-white/10 rounded-full">
                  <X size={24}/>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 max-h-[75vh] overflow-y-auto custom-scrollbar bg-base-100">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                  
                  {/* Left Column */}
                  <div className="space-y-8">
                    <section>
                      <label className="text-[10px] font-black uppercase text-primary mb-3 block tracking-widest flex items-center gap-2">
                        <ShieldCheck size={14}/> Coupon Identity
                      </label>
                      <input 
                        required
                        placeholder="e.g. LIFELINE20"
                        className="input-field w-full font-black text-lg uppercase tracking-widest !bg-base-200"
                        value={formData.code}
                        onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                      />
                    </section>

                    <section>
                      <label className="text-[10px] font-black uppercase text-primary mb-3 block tracking-widest">Eligibility Tier</label>
                      <select 
                        className="input-field w-full font-bold"
                        value={formData.eligibility.type}
                        onChange={(e) => setFormData({...formData, eligibility: { ...formData.eligibility, type: e.target.value }})}
                      >
                        <option value="General">General Public</option>
                        <option value="New_User_Only">New Users Only</option>
                        <option value="First_Booking">First Service Booking</option>
                        <option value="Subscription_Renewal">Subscription Renewals</option>
                      </select>
                    </section>

                    <section className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black uppercase opacity-50 mb-2 block">Min. Spend ($)</label>
                        <input type="number" className="input-field w-full" value={formData.eligibility.minOrderValue} 
                        onChange={(e) => setFormData({...formData, eligibility: {...formData.eligibility, minOrderValue: e.target.value}})}/>
                      </div>
                      <div>
                        <label className="text-[10px] font-black uppercase opacity-50 mb-2 block">Per User Limit</label>
                        <input type="number" className="input-field w-full" value={formData.usage.limitPerUser}
                        onChange={(e) => setFormData({...formData, usage: {...formData.usage, limitPerUser: e.target.value}})}/>
                      </div>
                    </section>
                  </div>

                  {/* Right Column */}
                  <div className="space-y-8">
                    <section className="p-6 bg-primary/5 rounded-2xl border border-primary/10 shadow-inner">
                      <label className="text-[10px] font-black uppercase text-primary mb-4 block tracking-widest">Benefit Calculation</label>
                      <div className="flex gap-2 mb-4 bg-base-200 p-1 rounded-xl">
                        {['Percentage', 'Flat_Amount'].map(type => (
                          <button
                            key={type}
                            type="button"
                            onClick={() => setFormData({...formData, benefit: {...formData.benefit, type}})}
                            className={`flex-1 py-2 text-[10px] font-black rounded-lg transition-all duration-200 uppercase ${
                              formData.benefit.type === type ? 'bg-primary text-white shadow-lg' : 'opacity-40 hover:opacity-100'
                            }`}
                          >
                            {type.replace('_', ' ')}
                          </button>
                        ))}
                      </div>
                      <div className="relative">
                        <input 
                          type="number" 
                          className="input-field w-full pl-12 text-xl font-black" 
                          value={formData.benefit.value}
                          onChange={(e) => setFormData({...formData, benefit: {...formData.benefit, value: e.target.value}})}
                        />
                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                          {formData.benefit.type === 'Percentage' ? <Percent size={20}/> : <DollarSign size={20}/>}
                        </div>
                      </div>
                    </section>

                    <section>
                      <label className="text-[10px] font-black uppercase text-primary mb-3 block tracking-widest flex items-center gap-2">
                        <Calendar size={14}/> Validity Window
                      </label>
                      <div className="space-y-3">
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-20">FROM</span>
                           <input type="date" className="input-field w-full pl-16 font-bold" value={formData.validity.from} 
                           onChange={(e) => setFormData({...formData, validity: {...formData.validity, from: e.target.value}})}/>
                        </div>
                        <div className="relative">
                           <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[10px] font-black opacity-20">TO</span>
                           <input type="date" className="input-field w-full pl-16 font-bold" value={formData.validity.to}
                           onChange={(e) => setFormData({...formData, validity: {...formData.validity, to: e.target.value}})}/>
                        </div>
                      </div>
                    </section>
                  </div>
                </div>

                <div className="mt-12 pt-8 border-t border-base-300 flex flex-col md:flex-row gap-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-6 py-3 font-black uppercase text-xs tracking-[0.2em] opacity-40  btn-secondary text-white  hover:opacity-100 transition-opacity">Discard Changes</button>
                  <button type="submit" className="flex-[2] btn-primary-cta !py-4  shadow-primary">
                    {editingCoupon ? 'Update Coupon Data' : 'Launch New Coupon'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default PromotionCouponManagement;