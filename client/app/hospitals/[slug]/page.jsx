"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useSelector, useDispatch } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { fetchHospitalBySlug } from "@/store/slices/hospitalSlice";
import { 
  MapPin, 
  Phone, 
  Globe, 
  ShieldCheck, 
  Bed, 
  Stethoscope, 
  Zap, 
  ArrowLeft,
  Share2,
  Mail,
  Star,
  Activity,
  Award,
  Navigation,
  HeartPulse,
  LayoutGrid
} from "lucide-react";
import Link from "next/link";

const HospitalDetails = () => {
  const { slug } = useParams();
  const dispatch = useDispatch();
  const { currentHospital, loading, error } = useSelector((state) => state.hospital);
  
  // State for image gallery
  const [activeImage, setActiveImage] = useState(0);

  useEffect(() => {
    if (slug) {
      dispatch(fetchHospitalBySlug(slug));
    }
  }, [dispatch, slug]);

  // Set active image when hospital data loads
  useEffect(() => {
    if (currentHospital?.images?.length > 0) {
      setActiveImage(0);
    }
  }, [currentHospital]);

  const accentGradient = "linear-gradient(90deg, #dc2626, #f87171)";

  if (loading) return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center gap-4">
      <div className="w-16 h-16 border-4 border-error/20 border-t-error rounded-full animate-spin" />
      <p className="text-[10px] font-black uppercase tracking-[0.3em] text-error animate-pulse">Initializing Medical Data</p>
    </div>
  );

  if (error || !currentHospital) return (
    <div className="min-h-screen bg-base-100 flex flex-col items-center justify-center p-6 text-center">
      <div className="w-20 h-20 bg-error/10 text-error rounded-full flex items-center justify-center mb-6">
        <Activity size={40} />
      </div>
      <h2 className="text-4xl font-black tracking-tighter mb-4 uppercase">Node Disconnected</h2>
      <p className="text-base-content/60 mb-8 max-w-md font-medium">The medical facility synchronization failed or the record does not exist in our central registry.</p>
      <Link href="/hospitals" className="btn-primary-cta" style={{ background: accentGradient }}>
        Return to Directory
      </Link>
    </div>
  );

  // Helper for coordinates: Mongoose uses [lng, lat]
  const lng = currentHospital.address?.coordinates?.coordinates?.[0];
  const lat = currentHospital.address?.coordinates?.coordinates?.[1];
  const mapsUrl = `https://www.google.com/maps?q=${lat},${lng}`;

  return (
    <main className="min-h-screen bg-base-100 pb-24">
     

      <div className="container-custom py-10">
        {/* --- Navigation & Actions --- */}
        <div className="flex justify-between items-center mb-12">
          <Link href="/hospitals" className="group flex items-center gap-3 text-[11px] font-black uppercase tracking-[0.25em] text-base-content/40 hover:text-error transition-all">
            <div className="p-2 rounded-full bg-base-200 group-hover:bg-error/10 group-hover:text-error transition-all">
              <ArrowLeft size={16} />
            </div>
            Back to Hospitals
          </Link>
          <div className="flex gap-3">
            <button className="p-3 border border-base-300 rounded-xl hover:bg-base-200 hover:text-error transition-all shadow-sm">
              <Share2 size={18} />
            </button>
            <button className="p-3 border border-base-300 rounded-xl hover:bg-base-200 transition-all shadow-sm">
              <HeartPulse size={18} className="text-error" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* --- Left Column: Visuals & Identity --- */}
          <div className="lg:col-span-7">
            
            {/* --- Image Gallery Section --- */}
            <section className="space-y-4 mb-10">
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <div className="aspect-[16/9] w-full rounded-3xl overflow-hidden border border-base-300 bg-base-200 shadow-2xl">
                  <AnimatePresence mode="wait">
                    <motion.img 
                      key={activeImage}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.4 }}
                      src={currentHospital.images?.[activeImage] || currentHospital.logo} 
                      alt={currentHospital.name}
                      className="w-full h-full object-cover"
                    />
                  </AnimatePresence>
                </div>

                {currentHospital.isVerified && (
                  <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md text-error px-5 py-2.5 rounded-2xl flex items-center gap-2 font-black text-[10px] uppercase tracking-widest shadow-2xl border border-error/20">
                    <ShieldCheck size={16} fill="currentColor" className="text-error/20" /> Verified Center
                  </div>
                )}
              </motion.div>

              {/* Thumbnails */}
              {currentHospital.images?.length > 1 && (
                <div className="flex flex-wrap gap-3 overflow-x-auto pb-2 no-scrollbar">
                  {currentHospital.images.map((img, idx) => (
                    <button 
                      key={idx}
                      onClick={() => setActiveImage(idx)}
                      className={`relative flex-shrink-0 w-24 h-16 ml-2 rounded-xl overflow-hidden border-2 transition-all ${
                        activeImage === idx ? "border-error scale-105 shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                      }`}
                    >
                      <img src={img} className="w-full h-full object-cover" alt="thumbnail" />
                    </button>
                  ))}
                </div>
              )}
            </section>

            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 bg-error/10 text-error text-[10px] font-black uppercase tracking-widest rounded-lg border border-error/20">
                    {currentHospital.hospitalType}
                  </span>
                  <div className="flex items-center gap-1 text-accent font-bold text-sm">
                    <Star size={16} fill="currentColor" /> {currentHospital.rating} 
                    <span className="text-base-content/40 font-medium">({currentHospital.reviewCount} reviews)</span>
                  </div>
                </div>
                
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-[0.9] text-base-content">
                  {currentHospital.name}
                </h1>
              </div>
              
              <div className="flex flex-wrap gap-2">
                {currentHospital.specialties?.map((dept, i) => (
                  <span key={i} className="px-4 py-2 bg-base-200 border border-base-300 text-[11px] font-bold uppercase tracking-wider rounded-xl hover:border-error/40 transition-colors cursor-default">
                    {dept}
                  </span>
                ))}
              </div>
              
              <div className="prose prose-lg">
                <p className="text-xl text-base-content/70 font-medium leading-relaxed max-w-2xl">
                    {currentHospital.description}
                </p>
              </div>

              {/* Facilities Grid */}
              <div className="pt-10 border-t border-base-300">
                <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-base-content/30 mb-6 flex items-center gap-2">
                  <LayoutGrid size={14} /> Advanced Facilities
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-6">
                  {currentHospital.facilities?.map((facility, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm font-bold text-base-content group">
                      <div className="w-10 h-10 rounded-xl bg-base-200 flex items-center justify-center group-hover:bg-error group-hover:text-white transition-all">
                        <Activity size={18} />
                      </div>
                      {facility}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* --- Right Column: Critical Data Panel --- */}
          <div className="lg:col-span-5">
            <div className="sticky top-28 space-y-8">
              
              {/* Vital Statistics Grid */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-6 bg-base-200/50 border border-base-300 rounded-3xl flex flex-col items-center text-center hover:border-error/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Bed className="text-error" size={24} />
                  </div>
                  <span className="text-3xl font-black tracking-tighter">{currentHospital.bedCount?.total || 0}</span>
                  <span className="text-[9px] font-black uppercase text-base-content/40 tracking-[0.2em] mt-1">Total Capacity</span>
                </div>

                <div className="p-6 bg-base-200/50 border border-base-300 rounded-3xl flex flex-col items-center text-center hover:border-error/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Zap className={currentHospital.isEmergencyReady ? "text-error" : "text-base-content/20"} size={24} fill={currentHospital.isEmergencyReady ? "currentColor" : "none"} />
                  </div>
                  <span className="text-3xl font-black tracking-tighter">{currentHospital.isEmergencyReady ? "READY" : "N/A"}</span>
                  <span className="text-[9px] font-black uppercase text-base-content/40 tracking-[0.2em] mt-1">ER Readiness</span>
                </div>

                <div className="p-6 bg-base-200/50 border border-base-300 rounded-3xl flex flex-col items-center text-center hover:border-error/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Award className="text-error" size={24} />
                  </div>
                  <span className="text-3xl font-black tracking-tighter">{currentHospital.commissionRate}%</span>
                  <span className="text-[9px] font-black uppercase text-base-content/40 tracking-[0.2em] mt-1">Cashless Benefit</span>
                </div>

                <div className="p-6 bg-base-200/50 border border-base-300 rounded-3xl flex flex-col items-center text-center hover:border-error/30 transition-all group">
                  <div className="w-12 h-12 rounded-2xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                    <Stethoscope className="text-error" size={24} />
                  </div>
                  <span className="text-3xl font-black tracking-tighter">{currentHospital.specialties?.length || 0}</span>
                  <span className="text-[9px] font-black uppercase text-base-content/40 tracking-[0.2em] mt-1">Departments</span>
                </div>
              </div>

              {/* Contact Card */}
              <div className="bg-neutral p-8 rounded-[2rem] text-neutral-content shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-error/10 rounded-full -mr-16 -mt-16 blur-3xl" />
                
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] mb-8 text-neutral-content/40 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-error animate-pulse" /> Medical Dispatch
                </h3>

                <div className="space-y-8">
                  <div className="flex items-start gap-5">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                      <MapPin className="text-error" size={22} />
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight mb-1">
                        {currentHospital.address?.line1}
                        </p>
                        <p className="text-xs opacity-50 uppercase tracking-widest font-black">
                        {currentHospital.address?.city}, {currentHospital.address?.state} • {currentHospital.address?.pincode}
                        </p>
                    </div>
                  </div>

                  <div className="flex items-start gap-5">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                      <Phone className="text-error" size={22} />
                    </div>
                    <div>
                       <p className="text-2xl font-black tracking-tighter leading-none mb-2">{currentHospital.contact?.phone}</p>
                       <div className="px-2 py-0.5 bg-error/20 text-error rounded text-[9px] font-black uppercase tracking-tighter inline-block">
                        Emergency: {currentHospital.contact?.emergencyPhone}
                       </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-5">
                    <div className="p-3 bg-white/5 rounded-2xl border border-white/10">
                      <Mail className="text-error" size={22} />
                    </div>
                    <p className="text-sm font-bold tracking-tight lowercase">{currentHospital.contact?.email}</p>
                  </div>
                </div>
                
                <div className="mt-10 grid grid-cols-1 gap-3">
                  <a 
                    href={currentHospital.contact?.website} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 bg-error text-white rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:brightness-110 transition-all active:scale-[0.98] shadow-lg shadow-error/20"
                  >
                    Official Website <Globe size={18} />
                  </a>
                  <a 
                    href={mapsUrl} 
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-5 border border-white/10 rounded-2xl font-black uppercase text-[11px] tracking-[0.2em] flex items-center justify-center gap-3 hover:bg-white/5 transition-all active:scale-[0.98]"
                  >
                    Live Navigation <Navigation size={18} />
                  </a>
                </div>
              </div>

              {/* Accepted Insurance Section */}
              {currentHospital.acceptedSchemes?.length > 0 && (
                <div className="p-6 border border-dashed border-base-300 rounded-3xl">
                  <h5 className="text-[10px] font-black uppercase tracking-widest text-base-content/40 mb-4">Accepted Coverage</h5>
                  <div className="flex flex-wrap gap-2">
                    {currentHospital.acceptedSchemes.map((scheme, idx) => (
                      <span key={idx} className="text-[10px] font-black uppercase px-3 py-1.5 bg-base-200 rounded-lg border border-base-300">
                        {scheme}
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      </div>
    </main>
  );
};

export default HospitalDetails;