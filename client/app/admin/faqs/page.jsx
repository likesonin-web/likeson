"use client";

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Plus, Search, LayoutGrid, List, ThumbsUp, ChevronDown, 
  Trash2, Edit3, Filter, HelpCircle, MessageSquare, 
  TrendingUp, Activity, BarChart3, AlertCircle 
} from 'lucide-react';
import { 
  fetchFAQs, createFAQ, updateFAQ, deleteFAQ, toggleLikeFAQ,
  selectAllFAQs, selectFAQLoading, selectFAQPagination 
} from '@/store/slices/faqSlice'; // Adjust path
import { toast } from 'react-hot-toast';

/**
 * @section COMPONENTS
 */

// 1. STATS HEADER COMPONENT (Analytics)
const FaqAnalytics = React.memo(({ items }) => {
  const stats = useMemo(() => [
    { label: 'Total FAQs', value: items.length, icon: HelpCircle, color: 'var(--primary)' },
    { label: 'Total Likes', value: items.reduce((acc, curr) => acc + curr.likeCount, 0), icon: ThumbsUp, color: 'var(--secondary)' },
    { label: 'Categories', value: new Set(items.map(i => i.category)).size, icon: BarChart3, color: 'var(--accent)' },
    { label: 'Active Support', value: '24/7', icon: Activity, color: 'var(--success)' },
  ], [items]);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {stats.map((stat, idx) => (
        <motion.div
          key={stat.label}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: idx * 0.1 }}
          className="glass-card p-6 flex items-center gap-4"
        >
          <div className="p-3 rounded-xl" style={{ backgroundColor: `${stat.color}20` }}>
            <stat.icon size={24} style={{ color: stat.color }} />
          </div>
          <div>
            <p className="text-sm font-medium opacity-60">{stat.label}</p>
            <h3 className="text-2xl font-bold">{stat.value}</h3>
          </div>
        </motion.div>
      ))}
    </div>
  );
});

// 2. FAQ ITEM COMPONENT
const FaqItem = ({ item, isAdmin, onEdit, onDelete, onLike, viewMode }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`glass-card overflow-hidden ${viewMode === 'grid' ? 'h-full flex flex-col' : 'mb-4'}`}
    >
      <div 
        className="p-5 cursor-pointer flex items-start justify-between gap-4"
        onClick={() => setIsOpen(!isOpen)}
      >
        <div className="flex-1">
          <span className="badge badge-primary mb-2">{item.category}</span>
          <h6 className="font-medium text-lg leading-tight">{item.question}</h6>
        </div>
        <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
          <ChevronDown size={20} className="text-primary" />
        </motion.div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="px-5 pb-5"
          >
            <div className="divider !my-2" />
            <p className="text-base-content/80 text-sm md:text-base font-normal font-family-poppins leading-relaxed mb-4">
              {item.answer}
            </p>
            
            <div className="flex items-center justify-between mt-4">
              <button 
                onClick={(e) => { e.stopPropagation(); onLike(item._id); }}
                className="flex items-center gap-2 text-sm font-bold hover:text-primary transition-colors"
              >
                <ThumbsUp size={16} className={item.likes?.length > 0 ? "fill-primary text-primary" : ""} />
                {item.likeCount} Likes
              </button>

              {isAdmin && (
                <div className="flex gap-2">
                  <button onClick={(e) => { e.stopPropagation(); onEdit(item); }} className="p-2 hover:bg-info/20 rounded-lg text-info transition-colors">
                    <Edit3 size={18} />
                  </button>
                  <button onClick={(e) => { e.stopPropagation(); onDelete(item._id); }} className="p-2 hover:bg-error/20 rounded-lg text-error transition-colors">
                    <Trash2 size={18} />
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

/**
 * @section MAIN PAGE COMPONENT
 */
const FaqManagement = () => {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.user?.user) || null;
  const items = useSelector(selectAllFAQs);
  const loading = useSelector(selectFAQLoading);
  const pagination = useSelector(selectFAQPagination);

  // UI State
  const [viewMode, setViewMode] = useState('list'); // 'grid' | 'list'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  // Form State
  const [formData, setFormData] = useState({ question: '', answer: '', category: 'General' });

  const isAdmin = ['admin', 'superadmin'].includes(user?.role);

  useEffect(() => {
    dispatch(fetchFAQs({ category: selectedCategory === 'All' ? undefined : selectedCategory }));
  }, [dispatch, selectedCategory]);

  const handleSearch = useCallback((e) => {
    setSearchTerm(e.target.value);
    // Debounced dispatch could be added here for production search API
  }, []);

  const handleToggleLike = (id) => {
    if (!user) return toast.error('Please login to like');
    dispatch(toggleLikeFAQ(id));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (editingId) {
      await dispatch(updateFAQ({ id: editingId, formData }));
    } else {
      await dispatch(createFAQ(formData));
    }
    setIsModalOpen(false);
    setFormData({ question: '', answer: '', category: 'General' });
    setEditingId(null);
  };

  const openEditModal = (item) => {
    setFormData({ question: item.question, answer: item.answer, category: item.category });
    setEditingId(item._id);
    setIsModalOpen(true);
  };

  // Filter logic for local search
  const filteredItems = items.filter(item => 
    item.question.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="container-custom py-10 max-w-7xl">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-6">
        <div>
          <h1 className="section-heading">Support Center</h1>
          <p className="section-subheading">How can we help you today? Find answers to common medical and service queries.</p>
        </div>
        
        {isAdmin && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary-cta flex items-center gap-2 self-start"
          >
            <Plus size={20} /> Create FAQ
          </button>
        )}
      </div>

      {/* Analytics Overview */}
      <FaqAnalytics items={items} />

      {/* Controls Bar */}
      <div className="glass-card p-4 mb-8 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 opacity-40" size={18} />
            <input 
              type="text" 
              placeholder="Search questions..." 
              className="input-field w-full pl-10"
              value={searchTerm}
              onChange={handleSearch}
            />
          </div>
          <select 
            className="input-field min-w-[160px]"
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="All">All Categories</option>
            <option value="Medical Transportation">Transportation</option>
            <option value="Doctor Consultation">Consultation</option>
            <option value="Diagnostics">Diagnostics</option>
            <option value="Pharmacy Services">Pharmacy</option>
          </select>
        </div>

        <div className="flex items-center bg-base-200 p-1 rounded-lg border border-base-300">
          <button 
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-primary text-white shadow-sm' : 'opacity-50'}`}
          >
            <List size={20} />
          </button>
          <button 
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-primary text-white shadow-sm' : 'opacity-50'}`}
          >
            <LayoutGrid size={20} />
          </button>
        </div>
      </div>

      {/* Content Area */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <div key={i} className="skeleton h-48 w-full rounded-2xl" />)}
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-20 glass-card">
          <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
          <h3 className="text-xl font-bold">No FAQs Found</h3>
          <p className="opacity-60">Try adjusting your search or filters.</p>
        </div>
      ) : (
        <motion.div 
          layout
          className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6' : 'max-w-4xl mx-auto'}
        >
          <AnimatePresence mode='popLayout'>
            {filteredItems.map((item) => (
              <FaqItem 
                key={item._id}
                item={item}
                isAdmin={isAdmin}
                viewMode={viewMode}
                onLike={handleToggleLike}
                onEdit={openEditModal}
                onDelete={(id) => dispatch(deleteFAQ(id))}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Admin Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-neutral/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.9, y: 20 }}
              className="glass-card w-full max-w-lg relative z-10 p-8 shadow-2xl"
            >
              <h2 className="text-2xl font-bold mb-6">{editingId ? 'Edit FAQ' : 'New FAQ'}</h2>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="text-xs font-bold uppercase mb-1 block opacity-60">Category</label>
                  <select 
                    className="input-field w-full"
                    value={formData.category}
                    onChange={(e) => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="Medical Transportation">Medical Transportation</option>
                    <option value="Care Assistant">Care Assistant</option>
                    <option value="Doctor Consultation">Doctor Consultation</option>
                    <option value="Diagnostics">Diagnostics</option>
                    <option value="Pharmacy Services">Pharmacy Services</option>
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold uppercase mb-1 block opacity-60">Question</label>
                  <input 
                    required
                    className="input-field w-full"
                    value={formData.question}
                    onChange={(e) => setFormData({...formData, question: e.target.value})}
                    placeholder="e.g., How do I book an ambulance?"
                  />
                </div>
                <div>
                  <label className="text-xs font-bold uppercase mb-1 block opacity-60">Answer</label>
                  <textarea 
                    required
                    rows={4}
                    className="input-field w-full resize-none"
                    value={formData.answer}
                    onChange={(e) => setFormData({...formData, answer: e.target.value})}
                    placeholder="Provide a detailed explanation..."
                  />
                </div>
                <div className="flex gap-4 pt-4">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 btn-secondary !py-2">Cancel</button>
                  <button type="submit" className="flex-1 btn-success !py-2">Save FAQ</button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default FaqManagement;