"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Video, Plus, Search, Calendar, Grid, List, Users, 
  Clock, Link as LinkIcon, X, CheckCircle2, AlertCircle, 
  ChevronRight, Filter, MoreVertical, LayoutDashboard
} from 'lucide-react';
import { 
  fetchEmployees, createMeeting, fetchMyMeetings, cancelMeeting 
} from '@/store/slices/meetingSlice';
import moment from 'moment';

const MeetingPage = () => {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.user);
  const { meetings, employees, loading, fetchingEmployees } = useSelector((state) => state.meeting);

  // UI State
  const [view, setView] = useState('grid'); // grid | list
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState('today'); // today, tomorrow, yesterday, custom
  const [selectedMeeting, setSelectedMeeting] = useState(null);

  // Create Meeting Form State
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    meetingType: 'consultation',
    participants: [], // Array of {userId, role}
  });

  useEffect(() => {
    dispatch(fetchMyMeetings());
    dispatch(fetchEmployees());
  }, [dispatch]);

  // --- Filtering Logic ---
  const filteredMeetings = useMemo(() => {
    return meetings.filter(m => {
      const matchesSearch = m.title.toLowerCase().includes(searchQuery.toLowerCase());
      
      const meetingDate = moment(m.startTime).startOf('day');
      const today = moment().startOf('day');
      
      let matchesDate = true;
      if (dateFilter === 'today') matchesDate = meetingDate.isSame(today);
      else if (dateFilter === 'tomorrow') matchesDate = meetingDate.isSame(today.add(1, 'days'));
      else if (dateFilter === 'yesterday') matchesDate = meetingDate.isSame(today.subtract(1, 'days'));
      
      return matchesSearch && matchesDate;
    });
  }, [meetings, searchQuery, dateFilter]);

  // --- Analytics Data (Calculated from meetings) ---
  const stats = [
    { label: 'Total Meetings', value: meetings.length, icon: Video, color: 'var(--chart-1)' },
    { label: 'Active Now', value: meetings.filter(m => m.status === 'active').length, icon: ActivityIcon, color: 'var(--chart-2)' },
    { label: 'Scheduled', value: meetings.filter(m => m.status === 'scheduled').length, icon: Calendar, color: 'var(--chart-3)' },
    { label: 'Cancelled', value: meetings.filter(m => m.status === 'cancelled').length, icon: AlertCircle, color: 'var(--chart-6)' },
  ];

  const handleCreateMeeting = (e) => {
    e.preventDefault();
    dispatch(createMeeting(formData)).then((res) => {
      if (!res.error) setIsModalOpen(false);
    });
  };

  const toggleParticipant = (empId) => {
    setFormData(prev => {
      const isSelected = prev.participants.find(p => p.userId === empId);
      if (isSelected) {
        return { ...prev, participants: prev.participants.filter(p => p.userId !== empId) };
      } else {
        return { ...prev, participants: [...prev.participants, { userId: empId, role: 'participant' }] };
      }
    });
  };

  return (
    <div className="container-custom py-8 space-y-8 animate-fade-in">
      
      {/* --- TOP: ANALYSIS SECTION --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="glass-card p-6 flex items-center justify-between overflow-hidden relative"
          >
            <div>
              <p className="text-sm font-medium text-base-content/60">{stat.label}</p>
              <h3 className="text-3xl font-black mt-1">{stat.value}</h3>
            </div>
            <div 
              className="p-3 rounded-md text-white shadow-lg animate-pulse-glow"
              style={{ backgroundColor: stat.color }}
            >
              <stat.icon size={24} />
            </div>
          </motion.div>
        ))}
      </div>

      {/* --- MIDDLE: SEARCH & FILTERS --- */}
      <div className="flex flex-wrap items-center justify-between gap-4 glass-card p-4">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-base-content/40" size={18} />
            <input 
              type="text" 
              placeholder="Search meetings by title..." 
              className="input-field w-full pl-10"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="btn-primary-cta flex items-center gap-2 whitespace-nowrap !py-2.5"
          >
            <Plus size={18} /> New Meeting
          </button>
        </div>

        <div className="flex items-center gap-2 bg-base-200 p-1 rounded-md">
          {['yesterday', 'today', 'tomorrow'].map((d) => (
            <button
              key={d}
              onClick={() => setDateFilter(d)}
              className={`px-4 py-1.5 rounded-sm text-xs font-bold uppercase transition-all ${
                dateFilter === d ? 'bg-primary text-white' : 'hover:bg-base-300'
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 bg-base-200 p-1 rounded-md">
          <button 
            onClick={() => setView('grid')}
            className={`p-2 rounded-sm ${view === 'grid' ? 'bg-white shadow-sm text-primary' : 'text-base-content/40'}`}
          >
            <Grid size={18} />
          </button>
          <button 
            onClick={() => setView('list')}
            className={`p-2 rounded-sm ${view === 'list' ? 'bg-white shadow-sm text-primary' : 'text-base-content/40'}`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* --- BOTTOM: MAIN CONTENT --- */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* LEFT: MEETING LIST */}
        <div className="lg:col-span-8 space-y-4">
          <AnimatePresence mode='popLayout'>
            {filteredMeetings.length > 0 ? (
              <div className={view === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 gap-4' : 'space-y-3'}>
                {filteredMeetings.map((meeting) => (
                  <MeetingCard 
                    key={meeting._id} 
                    meeting={meeting} 
                    view={view} 
                    isActive={selectedMeeting?._id === meeting._id}
                    onClick={() => setSelectedMeeting(meeting)}
                  />
                ))}
              </div>
            ) : (
              <div className="glass-card p-12 text-center">
                <div className="w-16 h-16 bg-base-200 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Video className="text-base-content/20" size={32} />
                </div>
                <h3 className="text-xl font-bold">No meetings found</h3>
                <p className="text-base-content/60">Try changing your search or date filters.</p>
              </div>
            )}
          </AnimatePresence>
        </div>

        {/* RIGHT: MEETING DETAILS VIEW */}
        <div className="lg:col-span-4">
          <div className="glass-card p-6 sticky top-24 min-h-[400px]">
            {selectedMeeting ? (
              <div className="space-y-6">
                <div className="flex justify-between items-start">
                  <span className={`badge ${getStatusColor(selectedMeeting.status)}`}>
                    {selectedMeeting.status}
                  </span>
                  <button onClick={() => setSelectedMeeting(null)} className="text-base-content/40 hover:text-error">
                    <X size={20} />
                  </button>
                </div>

                <div>
                  <h2 className="text-2xl font-black">{selectedMeeting.title}</h2>
                  <p className="text-base-content/60 mt-2">{selectedMeeting.description}</p>
                </div>

                <div className="space-y-3 border-t border-b border-base-300 py-4">
                  <div className="flex items-center gap-3">
                    <Calendar className="text-primary" size={18} />
                    <span className="text-sm font-medium">
                      {moment(selectedMeeting.startTime).format('MMMM Do YYYY, h:mm a')}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Users className="text-primary" size={18} />
                    <span className="text-sm font-medium">{selectedMeeting.participants.length} Participants</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <LayoutDashboard className="text-primary" size={18} />
                    <span className="text-sm font-medium capitalize">{selectedMeeting.meetingType}</span>
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-base-content/40">Participants</h4>
                  <div className="flex -space-x-2 overflow-hidden">
                    {selectedMeeting.participants.map((p, i) => (
                      <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-base-300 flex items-center justify-center text-[10px] font-bold">
                        {p.user?.name?.charAt(0) || 'U'}
                      </div>
                    ))}
                  </div>
                </div>

                <a 
                  href={selectedMeeting.joinUrl} 
                  target="_blank"
                  className="btn-primary-cta w-full flex items-center justify-center gap-2"
                >
                  <Video size={18} /> Join Meeting Room
                </a>

                {selectedMeeting.host._id === user?._id && selectedMeeting.status !== 'cancelled' && (
                   <button 
                    onClick={() => dispatch(cancelMeeting(selectedMeeting._id))}
                    className="w-full text-xs font-bold text-error uppercase hover:underline"
                   >
                     Cancel Meeting
                   </button>
                )}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center opacity-40 py-20">
                <Video size={48} className="mb-4" />
                <p className="text-sm font-bold uppercase tracking-tighter">Select a meeting to view details</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- ADD MEETING MODAL --- */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-base-100 w-full max-w-2xl rounded-box shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-base-300 flex justify-between items-center bg-base-200">
                <h2 className="text-xl font-black flex items-center gap-2">
                  <Plus className="text-primary" /> Create New Meeting
                </h2>
                <button onClick={() => setIsModalOpen(false)}><X /></button>
              </div>

              <form onSubmit={handleCreateMeeting} className="p-6 overflow-y-auto space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase">Meeting Title</label>
                    <input 
                      required
                      className="input-field w-full" 
                      placeholder="e.g., Weekly Staff Review"
                      onChange={(e) => setFormData({...formData, title: e.target.value})}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold uppercase">Meeting Type</label>
                    <select 
                      className="input-field w-full"
                      onChange={(e) => setFormData({...formData, meetingType: e.target.value})}
                    >
                      <option value="consultation">Consultation</option>
                      <option value="internal">Internal</option>
                      <option value="support">Support</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase">Start Time</label>
                  <input 
                    type="datetime-local" 
                    required
                    className="input-field w-full"
                    onChange={(e) => setFormData({...formData, startTime: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase">Add Participants (Staff Only)</label>
                  <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 bg-base-200 rounded-md">
                    {employees.map(emp => (
                      <div 
                        key={emp._id}
                        onClick={() => toggleParticipant(emp._id)}
                        className={`p-2 rounded-sm cursor-pointer flex items-center gap-2 border transition-all ${
                          formData.participants.find(p => p.userId === emp._id) 
                          ? 'border-primary bg-primary/10' 
                          : 'border-transparent bg-white'
                        }`}
                      >
                        <div className="w-6 h-6 rounded-full bg-primary text-white text-[10px] flex items-center justify-center">
                          {emp.name.charAt(0)}
                        </div>
                        <span className="text-xs font-medium truncate">{emp.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="pt-4 border-t border-base-300 flex gap-3">
                  <button type="button" onClick={() => setIsModalOpen(false)} className="btn-secondary flex-1">Cancel</button>
                  <button type="submit" className="btn-primary-cta flex-1" disabled={loading}>
                    {loading ? 'Scheduling...' : 'Schedule Meeting'}
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

// --- Sub-component: Meeting Card ---
const MeetingCard = ({ meeting, view, isActive, onClick }) => {
  const isGrid = view === 'grid';
  
  return (
    <motion.div 
      layout
      onClick={onClick}
      className={`cursor-pointer transition-all ${
        isGrid ? 'glass-card p-5' : 'flex items-center gap-4 p-4 card rounded-md'
      } ${isActive ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
    >
      <div className={`p-3 rounded-md bg-base-200 text-primary ${!isGrid && 'shrink-0'}`}>
        <Video size={isGrid ? 24 : 20} />
      </div>
      
      <div className="flex-1 min-w-0">
        <h4 className="font-bold truncate text-base-content">{meeting.title}</h4>
        <div className="flex items-center gap-3 mt-1 text-xs text-base-content/50">
          <span className="flex items-center gap-1"><Clock size={12}/> {moment(meeting.startTime).format('h:mm A')}</span>
          <span className="flex items-center gap-1"><Users size={12}/> {meeting.participants.length}</span>
        </div>
      </div>

      {isGrid && (
        <div className="mt-4 pt-4 border-t border-base-300 flex items-center justify-between">
          <span className={`badge ${getStatusColor(meeting.status)}`}>{meeting.status}</span>
          <ChevronRight size={16} className="text-base-content/30" />
        </div>
      )}

      {!isGrid && (
        <div className="flex items-center gap-4">
           <span className={`badge ${getStatusColor(meeting.status)} text-[10px]`}>{meeting.status}</span>
           <ChevronRight size={18} className="text-base-content/30" />
        </div>
      )}
    </motion.div>
  );
};

const getStatusColor = (status) => {
  switch (status) {
    case 'active': return 'badge-success';
    case 'scheduled': return 'badge-info';
    case 'cancelled': return 'badge-error';
    case 'completed': return 'badge-primary';
    default: return 'badge-neutral';
  }
};

const ActivityIcon = ({ size }) => <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}><Video size={size}/></motion.div>;

export default MeetingPage;