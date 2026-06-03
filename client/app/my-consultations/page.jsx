"use client";

import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  fetchPatientHistory,
  fetchPatientUpcoming,
  fetchPatientActive,
  fetchMyConsultations,
  selectConsultationList,
  selectLoading,
  selectError,
} from "@/store/slices/consultationSlice";
import {
  Calendar, Clock, Video, Mic, MessageSquare, User, Activity,
  ChevronRight, Star, AlertCircle, CheckCircle2, Filter, Search,
  RefreshCw, Stethoscope, Heart, Zap, Eye, MoreVertical, CalendarDays,
} from "lucide-react";

const STATUS_CONFIG = {
  scheduled:         { label: "Scheduled",       bg: "bg-info/10",      text: "text-info",             border: "border-info/20",    dot: "bg-info" },
  waiting:           { label: "Waiting",          bg: "bg-warning/10",   text: "text-warning",          border: "border-warning/20", dot: "bg-warning" },
  doctor_joined:     { label: "Doctor Ready",     bg: "bg-accent/10",    text: "text-accent",           border: "border-accent/20",  dot: "bg-accent" },
  patient_joined:    { label: "You Joined",       bg: "bg-accent/10",    text: "text-accent",           border: "border-accent/20",  dot: "bg-accent" },
  in_progress:       { label: "Live",             bg: "bg-success/10",   text: "text-success",          border: "border-success/20", dot: "bg-success" },
  paused:            { label: "Paused",           bg: "bg-warning/10",   text: "text-warning",          border: "border-warning/20", dot: "bg-warning" },
  completed:         { label: "Completed",        bg: "bg-success/10",   text: "text-success",          border: "border-success/20", dot: "bg-success" },
  cancelled:         { label: "Cancelled",        bg: "bg-error/10",     text: "text-error",            border: "border-error/20",   dot: "bg-error" },
  missed:            { label: "Missed",           bg: "bg-error/10",     text: "text-error",            border: "border-error/20",   dot: "bg-error" },
  no_show_patient:   { label: "No Show",          bg: "bg-error/10",     text: "text-error",            border: "border-error/20",   dot: "bg-error" },
  no_show_doctor:    { label: "Doctor No Show",   bg: "bg-error/10",     text: "text-error",            border: "border-error/20",   dot: "bg-error" },
  technical_failure: { label: "Technical Issue",  bg: "bg-base-300/40",  text: "text-base-content/60",  border: "border-base-300",   dot: "bg-base-content/40" },
};

const TYPE_ICON = {
  video:      { icon: Video,         label: "Video" },
  audio:      { icon: Mic,           label: "Audio" },
  chat:       { icon: MessageSquare, label: "Chat" },
  in_person:  { icon: User,          label: "In Person" },
  home_visit: { icon: Stethoscope,   label: "Home Visit" },
};

const TABS = [
  { id: "active",   label: "Active",   icon: Zap      },
  { id: "upcoming", label: "Upcoming", icon: Calendar  },
  { id: "history",  label: "History",  icon: Clock     },
  { id: "all",      label: "All",      icon: Activity  },
];

// ── MedBot Empty State ──────────────────────────────────────────────────────

function EmptyStateCreature({ isSearching }) {
  return (
    <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-4">
      <svg viewBox="0 0 200 200" className="w-full h-full overflow-visible">
        <defs>
          <filter id="bot-shadow" x="-20%" y="-20%" width="140%" height="140%">
            <feDropShadow dx="0" dy="8" stdDeviation="6" floodColor="var(--base-content)" floodOpacity="0.1" />
          </filter>
          <filter id="glass-shine" x="0" y="0" width="100%" height="100%">
            <feGaussianBlur in="SourceGraphic" stdDeviation="2" />
          </filter>
        </defs>
        <motion.ellipse cx="100" cy="180" rx="35" ry="8" fill="var(--base-300)"
          animate={{ rx: [35, 25, 35], opacity: [0.8, 0.4, 0.8] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} />
        <motion.g animate={{ y: [0, -12, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}>
          <rect x="55" y="40" width="90" height="110" rx="45" fill="var(--base-100)" stroke="var(--base-300)" strokeWidth="3" filter="url(#bot-shadow)" />
          <path d="M55 85 V 85 C 55 60 75 40 100 40 C 125 40 145 60 145 85 Z" fill="var(--primary)" />
          <path d="M55 85 V 85 C 55 60 75 40 100 40 C 125 40 145 60 145 85 Z" fill="white" opacity="0.15" />
          <rect x="70" y="65" width="60" height="36" rx="18" fill="var(--neutral)" stroke="var(--base-100)" strokeWidth="2" />
          <ellipse cx="85" cy="72" rx="8" ry="4" fill="white" opacity="0.2" transform="rotate(-15 85 72)" filter="url(#glass-shine)" />
          {isSearching ? (
            <>
              <motion.g animate={{ x: [-8, 8, -8] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}>
                <circle cx="90" cy="83" r="5" fill="var(--accent)" />
                <circle cx="110" cy="83" r="5" fill="var(--accent)" />
              </motion.g>
              <g transform="translate(135, 100)">
                <path d="M 0 0 Q 15 10 20 25" fill="none" stroke="var(--base-300)" strokeWidth="4" strokeLinecap="round" />
                <motion.g animate={{ rotate: [0, -15, 0], x: [0, 5, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} style={{ transformOrigin: "20px 25px" }}>
                  <circle cx="20" cy="35" r="10" fill="transparent" stroke="var(--primary)" strokeWidth="3" />
                  <line x1="13" y1="28" x2="6" y2="21" stroke="var(--primary)" strokeWidth="3" strokeLinecap="round" />
                  <circle cx="20" cy="35" r="7" fill="var(--info)" opacity="0.3" />
                </motion.g>
              </g>
            </>
          ) : (
            <>
              <motion.g animate={{ scaleY: [1, 0.1, 1] }} transition={{ duration: 4, repeat: Infinity, times: [0, 0.1, 0.2] }}>
                <path d="M 84 83 Q 87 86 90 83" fill="none" stroke="var(--primary-content)" strokeWidth="2.5" strokeLinecap="round" />
                <path d="M 110 83 Q 113 86 116 83" fill="none" stroke="var(--primary-content)" strokeWidth="2.5" strokeLinecap="round" />
              </motion.g>
              <motion.text x="145" y="55" fontSize="14" fontWeight="bold" fill="var(--base-content)" opacity="0.4"
                animate={{ y: [0, -15], x: [0, 10], opacity: [0, 0.6, 0], scale: [0.8, 1.2] }}
                transition={{ duration: 3, repeat: Infinity, delay: 0 }}>Z</motion.text>
              <motion.text x="155" y="40" fontSize="18" fontWeight="bold" fill="var(--base-content)" opacity="0.4"
                animate={{ y: [0, -20], x: [0, 15], opacity: [0, 0.5, 0], scale: [0.8, 1.3] }}
                transition={{ duration: 3, repeat: Infinity, delay: 1 }}>Z</motion.text>
            </>
          )}
          <g transform="translate(87, 115)">
            <rect x="8" y="0" width="10" height="26" rx="2" fill="var(--base-200)" />
            <rect x="0" y="8" width="26" height="10" rx="2" fill="var(--base-200)" />
            <rect x="9" y="1" width="8" height="24" rx="1" fill="var(--base-300)" />
            <rect x="1" y="9" width="24" height="8" rx="1" fill="var(--base-300)" />
          </g>
          <line x1="100" y1="40" x2="100" y2="20" stroke="var(--base-300)" strokeWidth="3" strokeLinecap="round" />
          <motion.circle cx="100" cy="20" r="5" fill="var(--primary)"
            animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }} />
        </motion.g>
      </svg>
    </div>
  );
}

// ── Stat Card ───────────────────────────────────────────────────────────────

function StatCard({ icon: Icon, value, label, colorClass, delay = 0 }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: "spring", stiffness: 200 }}
      className="card p-3 sm:p-4 hover:-translate-y-1 transition-transform"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="text-base-content/60 text-[9px] font-semibold uppercase tracking-wider">{label}</div>
        <div className={`w-7 h-7 rounded-full flex items-center justify-center ${colorClass} bg-opacity-10`}>
          <Icon className={`w-3.5 h-3.5 ${colorClass.replace('bg-', 'text-').split('/')[0]}`} />
        </div>
      </div>
      <div className="text-xl sm:text-2xl font-bold font-montserrat text-base-content">{value}</div>
    </motion.div>
  );
}

// ── Consultation Card ───────────────────────────────────────────────────────

function ConsultationCard({ consultation, index }) {
  const st = STATUS_CONFIG[consultation?.status] ?? STATUS_CONFIG.scheduled;
  const typeInfo = TYPE_ICON[consultation?.consultationType] ?? TYPE_ICON.video;
  const TypeIcon = typeInfo.icon;
  const isLive = consultation?.status === "in_progress" || consultation?.status === "doctor_joined";
  const isUpcoming = consultation?.status === "scheduled" || consultation?.status === "waiting";

  const scheduledAt = consultation?.scheduledAt ? new Date(consultation.scheduledAt) : null;
  const doctorName = consultation?.doctorSnapshot?.name ?? consultation?.doctor?.user?.name ?? "Unknown Doctor";
  const spec = consultation?.doctorSnapshot?.specialization ?? consultation?.doctor?.specialization ?? "General Practice";

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ delay: index * 0.05, type: "spring", stiffness: 250, damping: 25 }}
      className="glass-card p-3 group relative flex flex-col gap-2.5 overflow-hidden"
    >
      {isLive && <div className="absolute top-0 left-0 w-full h-0.5 bg-success animate-pulse" />}

      {/* Top Row */}
      <div className="flex justify-between items-start gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 border border-primary/20">
            <Stethoscope className="w-4 h-4 text-primary" />
          </div>
          <div className="min-w-0">
            <h3 className="font-bold text-sm text-base-content truncate">{doctorName}</h3>
            <p className="text-[10px] text-base-content/60 truncate">{spec}</p>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 flex-shrink-0">
          <span className={`badge badge-sm border ${st.bg} ${st.text} ${st.border}`}>
            <span className={`status-dot ${st.dot} mr-1 ${isLive ? 'animate-ping' : ''}`} />
            {st.label}
          </span>
          <button className="text-base-content/40 hover:text-base-content transition-colors sm:opacity-0 sm:group-hover:opacity-100 p-0.5">
            <MoreVertical className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Meta Row */}
      <div className="bg-base-200/50 rounded-lg px-2.5 py-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-base-content/70 border border-base-300/50">
        <div className="flex items-center gap-1.5">
          <TypeIcon className="w-3 h-3 text-base-content/50" />
          <span className="font-medium">{typeInfo.label}</span>
        </div>
        {scheduledAt && (
          <>
            <div className="flex items-center gap-1.5">
              <CalendarDays className="w-3 h-3 text-base-content/50" />
              <span className="font-medium">{scheduledAt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-base-content/50" />
              <span className="font-medium">{scheduledAt.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
          </>
        )}
        {consultation?.slotDurationMin && (
          <div className="flex items-center gap-1.5">
            <Activity className="w-3 h-3 text-base-content/50" />
            <span className="font-medium">{consultation.slotDurationMin} Min</span>
          </div>
        )}
      </div>

      {/* Rating */}
      {consultation?.isRated && consultation?.rating?.doctorRating && (
        <div className="flex items-center gap-1.5 px-0.5">
          <div className="flex">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className={`w-3 h-3 ${i < consultation.rating.doctorRating ? "text-warning fill-warning" : "text-base-300"}`} />
            ))}
          </div>
          {consultation.rating.doctorFeedback && (
            <span className="text-[9px] text-base-content/60 truncate italic max-w-xs">
              "{consultation.rating.doctorFeedback}"
            </span>
          )}
        </div>
      )}

      {/* Bottom Actions */}
      <div className="pt-2 mt-auto border-t border-base-300 flex items-center justify-between">
        <div className="text-[9px] font-mono text-base-content/40 bg-base-200 px-1.5 py-0.5 rounded border border-base-300">
          #{consultation?.consultationCode ?? "ID-PENDING"}
        </div>
        <div className="flex items-center gap-1.5">
          {isLive && (
            <button className="btn btn-success-cta btn-xs">
              <Video className="w-3 h-3 mr-1" /> Join
            </button>
          )}
          {isUpcoming && (
            <button className="btn btn-primary-cta btn-xs">
              <Eye className="w-3 h-3 mr-1" /> Details
            </button>
          )}
          {!isLive && !isUpcoming && (
            <button className="btn btn-ghost btn-xs gap-0.5 hover:bg-base-200">
              Details <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ── Empty State ─────────────────────────────────────────────────────────────

function EmptyState({ tab, isSearching }) {
  const msgs = {
    active:   { title: "No Active Sessions",   sub: "No ongoing consultations right now." },
    upcoming: { title: "Nothing Scheduled",    sub: "No upcoming appointments at the moment." },
    all:      { title: "No Consultations Yet", sub: "History appears once you book an appointment." },
    history:  { title: "No History Yet",       sub: "Completed consultations show up here." },
    search:   { title: "No Results Found",     sub: "No consultations match your search." },
  };
  const m = isSearching ? msgs.search : (msgs[tab] ?? msgs.all);

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-14 px-4 text-center bg-base-100/50 backdrop-blur-sm border border-dashed border-base-300 rounded-[var(--r-box)]"
    >
      <EmptyStateCreature isSearching={isSearching} />
      <h3 className="section-heading text-lg sm:text-xl mb-1">{m.title}</h3>
      <p className="text-base-content/60 text-sm max-w-xs">{m.sub}</p>
    </motion.div>
  );
}

// ── Main Page ───────────────────────────────────────────────────────────────

export default function PatientConsultationsPage() {
  const dispatch = useDispatch();
  const [activeTab, setActiveTab] = useState("upcoming");
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all");

  const fetchLoading = useSelector(selectLoading("fetch"));
  const error        = useSelector(selectError);

  const [tabData, setTabData] = useState({ active: [], upcoming: [], history: [], all: [] });

  useEffect(() => {
    const load = async () => {
      const [active, upcoming, history, all] = await Promise.all([
        dispatch(fetchPatientActive()),
        dispatch(fetchPatientUpcoming()),
        dispatch(fetchPatientHistory({})),
        dispatch(fetchMyConsultations({})),
      ]);
      setTabData({
        active:   active?.payload?.sessions        ?? [],
        upcoming: upcoming?.payload?.consultations ?? [],
        history:  history?.payload?.consultations  ?? [],
        all:      all?.payload?.consultations      ?? [],
      });
    };
    load();
  }, [dispatch]);

  const handleRefresh = () => {
    if (activeTab === "active")   dispatch(fetchPatientActive());
    if (activeTab === "upcoming") dispatch(fetchPatientUpcoming());
    if (activeTab === "history")  dispatch(fetchPatientHistory({}));
    if (activeTab === "all")      dispatch(fetchMyConsultations({}));
  };

  const currentList = tabData[activeTab] ?? [];
  const filtered = currentList.filter((c) => {
    const matchSearch = searchQuery
      ? (c?.doctorSnapshot?.name ?? "").toLowerCase().includes(searchQuery.toLowerCase()) ||
        (c?.consultationCode ?? "").toLowerCase().includes(searchQuery.toLowerCase())
      : true;
    const matchType = filterType !== "all" ? c?.consultationType === filterType : true;
    return matchSearch && matchType;
  });

  const stats = {
    total:     (tabData.all     ?? []).length,
    active:    (tabData.active  ?? []).length,
    upcoming:  (tabData.upcoming ?? []).length,
    completed: (tabData.history ?? []).filter((c) => c?.status === "completed").length,
  };

  return (
    <div className="min-h-screen bg-base-200 flex flex-col w-full overflow-x-hidden">

      {/* Header */}
      <div className="bg-primary pb-16 sm:pb-20 pt-5 sm:pt-8 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-white opacity-5 blur-3xl pointer-events-none" />
        <div className="max-w-6xl mx-auto relative z-10">
          <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="text-primary-content">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="bg-white/20 p-1 rounded-md backdrop-blur-sm shadow-sm border border-white/10">
                <Heart className="w-4 h-4 text-white" />
              </span>
              <span className="text-[10px] font-semibold tracking-wider uppercase text-white/90">Healthcare Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl text-base-content font-black font-montserrat tracking-tight mb-1.5">
              My Consultations
            </h1>
            <p className="text-primary-content/80 text-xs max-w-lg leading-relaxed">
              Manage appointments, join live calls, and review past consultations.
            </p>
          </motion.div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 w-full -mt-10 sm:-mt-12 relative z-10 pb-16">

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3 mb-5">
          <StatCard icon={Activity}     value={stats.total}     label="Total Sessions" colorClass="bg-info"    delay={0.1}  />
          <StatCard icon={Zap}          value={stats.active}    label="Active Now"     colorClass="bg-success" delay={0.15} />
          <StatCard icon={Calendar}     value={stats.upcoming}  label="Upcoming"       colorClass="bg-accent"  delay={0.2}  />
          <StatCard icon={CheckCircle2} value={stats.completed} label="Completed"      colorClass="bg-primary" delay={0.25} />
        </div>

        {/* Toolbar */}
        <div className="card p-2 sm:p-3 mb-4">
          <div className="flex flex-col lg:flex-row gap-3 items-center justify-between">

            {/* Tabs */}
            <div className="w-full lg:w-auto overflow-x-auto no-scrollbar pb-0.5 lg:pb-0">
              <div className="flex gap-1 min-w-max p-1 bg-base-200 rounded-lg border border-base-300">
                {TABS.map((tab) => {
                  const Icon = tab.icon;
                  const count = tabData[tab.id]?.length ?? 0;
                  const isActive = activeTab === tab.id;
                  return (
                    <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200
                        ${isActive
                          ? "bg-base-100 text-primary shadow-sm border border-base-300"
                          : "text-base-content/60 hover:bg-base-100/50 hover:text-base-content"
                        }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {tab.label}
                      {count > 0 && (
                        <span className={`text-[9px] px-1.5 py-px rounded-full font-bold ml-0.5 ${isActive ? "bg-primary text-primary-content" : "bg-base-300 text-base-content/70"}`}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search + Filter + Refresh */}
            <div className="flex flex-col sm:flex-row gap-2 w-full lg:w-auto">
              <div className="relative flex-grow sm:flex-grow-0 sm:w-56">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-base-content/40" />
                <input type="text" placeholder="Search doctor or ID..."
                  value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                  className="input-field pl-8 text-xs h-8" />
              </div>
              <div className="flex gap-1.5 w-full sm:w-auto">
                <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
                  className="rx-select flex-1 sm:w-32 font-medium text-xs h-8">
                  <option value="all">All Types</option>
                  <option value="video">Video</option>
                  <option value="audio">Audio</option>
                  <option value="chat">Chat</option>
                  <option value="in_person">In Person</option>
                  <option value="home_visit">Home Visit</option>
                </select>
                <button onClick={handleRefresh} disabled={fetchLoading}
                  className="btn btn-outline btn-circle btn-sm" title="Refresh">
                  <RefreshCw className={`w-3.5 h-3.5 ${fetchLoading ? "animate-spin" : ""}`} />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div initial={{ opacity: 0, height: 0, marginBottom: 0 }}
              animate={{ opacity: 1, height: "auto", marginBottom: 12 }}
              exit={{ opacity: 0, height: 0, marginBottom: 0 }}
              className="alert alert-error">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              <span className="font-medium text-xs">{error}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* List */}
        {fetchLoading ? (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="loading loading-spinner loading-md text-primary" />
            <p className="text-base-content/50 text-sm font-medium animate-pulse">Syncing appointments…</p>
          </div>
        ) : (
          <AnimatePresence mode="wait">
            <motion.div key={activeTab + filterType + searchQuery}
              initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }}>
              {filtered.length === 0 ? (
                <EmptyState tab={activeTab} isSearching={searchQuery.length > 0 || filterType !== "all"} />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 sm:gap-4">
                  {filtered.map((c, i) => (
                    <ConsultationCard key={c?._id ?? i} consultation={c} index={i} />
                  ))}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}} />
    </div>
  );
}