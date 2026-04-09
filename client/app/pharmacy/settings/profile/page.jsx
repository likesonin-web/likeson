"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import { 
  Save, User, Store, ShieldCheck, FileText, 
  UploadCloud, CheckCircle2, AlertCircle, Loader2,
  Briefcase, GraduationCap, MapPin, Phone, Building2,
  ExternalLink, Calendar, Award
} from "lucide-react";

import { updateProfile, getProfile } from "@/store/slices/userSlice";
import { uploadSingleFile } from "@/store/slices/uploadSlice";
import { cn } from "@/lib/utils";

/**
 * @section COMPONENTS
 */

const SectionHeader = ({ title, subtitle, icon: Icon }) => (
  <div className="flex items-center gap-4 mb-8">
    <div className="p-3 rounded-box bg-primary/10 text-primary">
      <Icon size={22} />
    </div>
    <div>
      <h2 className="text-xl font-black tracking-tight">{title}</h2>
      <p className="text-sm opacity-50 font-bold uppercase tracking-wider">{subtitle}</p>
    </div>
  </div>
);

const FormInput = ({ label, name, value, onChange, type = "text", placeholder, options, disabled }) => (
  <div className="flex flex-col gap-2">
    <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50 ml-1">
      {label}
    </label>
    {options ? (
      <select 
        name={name} 
        value={value} 
        onChange={onChange} 
        disabled={disabled}
        className="input-field appearance-none cursor-pointer"
      >
        <option value="">Select {label}</option>
        {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    ) : (
      <input 
        type={type} 
        name={name} 
        value={value || ""} 
        onChange={onChange} 
        disabled={disabled}
        placeholder={placeholder}
        className="input-field"
      />
    )}
  </div>
);

const KYCUploadBox = ({ label, url, onUpload, isUploading }) => (
  <div className="flex flex-col gap-3">
    <p className="text-[10px] font-black uppercase tracking-widest opacity-50">{label}</p>
    <div className={cn(
      "relative border-2 border-dashed rounded-box p-6 flex flex-col items-center justify-center transition-all min-h-[140px]",
      url ? "bg-success/5 border-success/30" : "bg-base-200 border-base-300 hover:border-primary/50"
    )}>
      {url ? (
        <div className="text-center animate-scale-in">
          <CheckCircle2 className="text-success mx-auto mb-2" size={30} />
          <p className="text-[10px] font-bold text-success uppercase">Document Verified</p>
          <a href={url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[9px] underline opacity-50 mt-1 hover:opacity-100">
            View Upload <ExternalLink size={10} />
          </a>
        </div>
      ) : (
        <div className="text-center opacity-40">
          <UploadCloud className="mx-auto mb-2" size={30} />
          <p className="text-[10px] font-bold uppercase">Click to upload PDF/JPG</p>
        </div>
      )}
      
      <input 
        type="file" 
        onChange={onUpload} 
        disabled={isUploading}
        className="absolute inset-0 opacity-0 cursor-pointer"
        accept=".pdf,.jpg,.jpeg,.png"
      />
      
      {isUploading && (
        <div className="absolute inset-0 bg-base-100/80 backdrop-blur-sm flex items-center justify-center rounded-box">
          <Loader2 className="animate-spin text-primary" size={24} />
        </div>
      )}
    </div>
  </div>
);

/**
 * @section MAIN PAGE
 */

export default function PharmacyProfilePage() {
  const dispatch = useDispatch();
  const { user, profile, loading: profileLoading } = useSelector((state) => state.user);
  const { isUploading } = useSelector((state) => state.upload);

  // 1. Unified Local Form State
  const [formData, setFormData] = useState({
    // User Identity
    name: "",
    phone: "",
    workStatus: "office",
    // Pharmacy Professional Data
    registrationNumber: "",
    qualification: "",
    experienceYears: 0,
    roleInStore: "Store Manager",
    pciCertificateUrl: "",
    idProofUrl: ""
  });

  // 2. Hydration Logic
  useEffect(() => {
    if (!profile) {
      dispatch(getProfile());
    }
  }, [dispatch, profile]);

  useEffect(() => {
    if (user && profile) {
      setFormData({
        name: user.name || "",
        phone: user.phone || "",
        workStatus: user.workStatus || "office",
        registrationNumber: profile.registrationNumber || "",
        qualification: profile.qualification || "",
        experienceYears: profile.experienceYears || 0,
        roleInStore: profile.roleInStore || "Store Manager",
        pciCertificateUrl: profile.verification?.pciCertificateUrl || "",
        idProofUrl: profile.verification?.idProofUrl || ""
      });
    }
  }, [user, profile]);

  // 3. Handlers
  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleFileUpload = async (e, fieldName) => {
    const file = e.target.files[0];
    if (!file) return;

    const result = await dispatch(uploadSingleFile({ file, folder: "Likeson/Pharmacy/Verification" }));
    if (result.payload?.url) {
      setFormData(prev => ({ ...prev, [fieldName]: result.payload.url }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const payload = {
      name: formData.name,
      phone: formData.phone,
      workStatus: formData.workStatus,
      roleProfileData: {
        registrationNumber: formData.registrationNumber,
        qualification: formData.qualification,
        experienceYears: Number(formData.experienceYears),
        roleInStore: formData.roleInStore,
        verification: {
          pciCertificateUrl: formData.pciCertificateUrl,
          idProofUrl: formData.idProofUrl
        }
      }
    };

    dispatch(updateProfile(payload));
  };

  return (
    <div className="container-custom py-10 animate-fade-in">
      <form onSubmit={handleSubmit} className="grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* ── LEFT: FORM FIELDS ─────────────────────────────────────────── */}
        <div className="xl:col-span-8 space-y-8">
          
          {/* Section 1: Basic Bio */}
          <div className="glass-card p-8">
            <SectionHeader 
              title="Identity Details" 
              subtitle="Personal & Availability Settings" 
              icon={User} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput 
                label="Professional Name" 
                name="name" 
                value={formData.name} 
                onChange={handleInputChange} 
              />
              <FormInput 
                label="Mobile Number" 
                name="phone" 
                value={formData.phone} 
                onChange={handleInputChange} 
              />
              <FormInput 
                label="Current Work Status" 
                name="workStatus" 
                value={formData.workStatus} 
                onChange={handleInputChange}
                options={['office', 'remote', 'on-leave', 'meeting']}
              />
            </div>
          </div>

          {/* Section 2: Clinical Credentials */}
          <div className="glass-card p-8">
            <SectionHeader 
              title="Clinical Profile" 
              subtitle="PCI Registration & Academic Info" 
              icon={GraduationCap} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <FormInput 
                label="PCI Registration No." 
                name="registrationNumber" 
                value={formData.registrationNumber} 
                onChange={handleInputChange} 
                placeholder="PCI-XXXXX-2026"
              />
              <FormInput 
                label="Degree / Qualification" 
                name="qualification" 
                value={formData.qualification} 
                onChange={handleInputChange}
                options={['D.Pharm', 'B.Pharm', 'M.Pharm', 'Pharm.D']}
              />
              <FormInput 
                label="Years of Experience" 
                name="experienceYears" 
                type="number"
                value={formData.experienceYears} 
                onChange={handleInputChange} 
              />
              <FormInput 
                label="Organizational Role" 
                name="roleInStore" 
                value={formData.roleInStore} 
                onChange={handleInputChange}
                options={['Chief Pharmacist', 'Store Manager', 'Inventory Head', 'Delivery Coordinator']}
              />
            </div>
          </div>

          {/* Section 3: Document KYC */}
          <div className="glass-card p-8">
            <SectionHeader 
              title="Compliance Documents" 
              subtitle="Government Issued Certificates" 
              icon={ShieldCheck} 
            />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <KYCUploadBox 
                label="PCI Certificate" 
                url={formData.pciCertificateUrl} 
                onUpload={(e) => handleFileUpload(e, "pciCertificateUrl")} 
                isUploading={isUploading}
              />
              <KYCUploadBox 
                label="National ID Proof" 
                url={formData.idProofUrl} 
                onUpload={(e) => handleFileUpload(e, "idProofUrl")} 
                isUploading={isUploading}
              />
            </div>
          </div>
        </div>

        {/* ── RIGHT: SUMMARY & STORE DATA ───────────────────────────────── */}
        <div className="xl:col-span-4 space-y-6">
          
          {/* Action Card */}
          <div className="glass-card p-6 sticky top-28">
            <div className="text-center mb-6">
              <div className="w-24 h-24 rounded-2xl border-4 border-primary mx-auto mb-4 overflow-hidden shadow-xl shadow-primary/20">
                <img src={user?.avatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <h3 className="font-black text-lg text-primary">{user?.name}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest opacity-40 mt-1">
                Pharmacist Node ID: {user?._id?.slice(-6)}
              </p>
            </div>

            <div className="divider" />

            {/* Profile Status Bits */}
            <div className="space-y-4 mb-8">
              <StatusBit label="KYC Verification" active={profile?.verification?.isVerified} />
              <StatusBit label="Email Verified" active={user?.isEmailVerified} />
              <StatusBit label="Phone Verified" active={user?.isPhoneVerified} />
            </div>

            <button 
              type="submit" 
              disabled={profileLoading || isUploading}
              className="btn-primary-cta w-full flex items-center justify-center gap-2 group"
            >
              {profileLoading ? <Loader2 className="animate-spin" /> : <Save size={18} className="group-hover:rotate-12 transition-transform" />}
              Commit All Changes
            </button>
          </div>

          {/* Assigned Store Metadata Card */}
          <AnimatePresence>
            {profile?.assignedStore && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="glass-card overflow-hidden"
              >
                <div className="bg-primary/5 p-4 border-b border-primary/10 flex items-center gap-3">
                  <Building2 className="text-primary" size={20} />
                  <h4 className="text-xs font-black uppercase tracking-widest">Linked Pharmacy Node</h4>
                </div>
                <div className="p-5 space-y-4">
                  <div>
                    <p className="text-lg font-black">{profile.assignedStore.storeName}</p>
                    <p className="text-[10px] opacity-50 font-bold uppercase">{profile.assignedStore.storeType} Store</p>
                  </div>
                  
                  <div className="space-y-2">
                    <div className="flex items-start gap-2 text-xs opacity-70">
                      <MapPin size={14} className="mt-0.5 text-primary" />
                      <span>{profile.assignedStore.address?.line1}, {profile.assignedStore.address?.city}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs opacity-70">
                      <Award size={14} className="text-primary" />
                      <span>License: {profile.assignedStore.legal?.dlNumber}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <span className={cn(
                        "badge text-[9px]",
                        profile.assignedStore.status === 'Open' ? "badge-success" : "badge-error"
                    )}>
                        {profile.assignedStore.status}
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </form>
    </div>
  );
}

/**
 * @section HELPERS
 */

const StatusBit = ({ label, active }) => (
  <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
    <span className="opacity-40">{label}</span>
    <span className={active ? "text-success" : "text-error"}>
      {active ? "Compliant" : "Pending"}
    </span>
  </div>
);