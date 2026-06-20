'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { 
  UserCircle, ShieldCheck, CalendarRange, Landmark, 
  ArrowRight, ExternalLink, Activity 
} from 'lucide-react';
import { 
  fetchMyDoctorProfile, 
  selectMyDoctorProfile 
} from '@/store/slices/hospitalSlice'; // Adjust import path as needed

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.15 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
};

export default function WelcomeDoctorPage() {
  const dispatch = useDispatch();
  const myProfile = useSelector(selectMyDoctorProfile);

  useEffect(() => {
    dispatch(fetchMyDoctorProfile());
  }, [dispatch]);

  // Extract name from the populated user object, fallback to 'Doctor'
  const doctorName = myProfile?.user?.name || 'Doctor';

  const steps = [
    {
      id: 1,
      title: 'Complete Profile',
      description: 'Add your medical qualifications, specializations, and upload a professional photo.',
      icon: <UserCircle className="w-8 h-8 text-primary" />,
      href: '/doctor/settings/profile',
    },
    {
      id: 2,
      title: 'Submit KYC',
      description: 'Upload your Aadhaar and PAN documents for seamless verification and payouts.',
      icon: <ShieldCheck className="w-8 h-8 text-secondary" />,
      href: '/doctor/settings/kyc',
    },
    {
      id: 3,
      title: 'Set Availability',
      description: 'Configure your weekly schedule, consultation types, and appointment slots.',
      icon: <CalendarRange className="w-8 h-8 text-accent" />,
      href: '/doctor/settings/availability',
    },
    {
      id: 4,
      title: 'Add Bank Details',
      description: 'Link your bank account to receive automated settlements for your consultations.',
      icon: <Landmark className="w-8 h-8 text-success" />,
      href: '/doctor/settings/bank',
    },
  ];

  return (
    <div data-theme="doctor" className="min-h-screen bg-base-100 safe-top safe-bottom py-12">
      <div className="container-custom py-10 max-w-6xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex flex-col items-center text-center mb-12"
        >
          <motion.div variants={itemVariants} className="badge badge-primary mb-4">
            Doctor Portal
          </motion.div>
          <motion.h1 variants={itemVariants} className="section-heading">
            Welcome to Likeson Healthcare, <span className="text-gradient-primary">Dr. {doctorName}</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="section-subheading max-w-2xl mx-auto mt-4">
            We are thrilled to have you on board. To get your digital clinic up and running, please complete the setup steps below.
          </motion.p>

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mt-6">
            <button className="btn btn-outline btn-sm">
              <Activity className="w-4 h-4" /> Toggle Online Status
            </button>
            <button className="btn btn-ghost btn-sm border border-base-300">
              <ExternalLink className="w-4 h-4" /> View Public Profile
            </button>
          </motion.div>
        </motion.div>

        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="grid-responsive"
        >
          {steps.map((step) => (
            <motion.div key={step.id} variants={itemVariants} className="glass-card flex flex-col h-full p-6 relative overflow-hidden group">
              <div className="absolute top-0 right-0 p-4 opacity-5 transform translate-x-4 -translate-y-4 transition-transform group-hover:scale-110">
                {step.icon}
              </div>
              
              <div className="flex-1">
                <div className="w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-6 shadow-sm">
                  {step.icon}
                </div>
                <h3 className="text-responsive-base font-bold text-base-content mb-2 font-montserrat">
                  {step.id}. {step.title}
                </h3>
                <p className="text-sm text-base-content/70 font-poppins mb-6">
                  {step.description}
                </p>
              </div>

              <Link href={step.href} className="mt-auto">
                <button className="btn btn-outline w-full justify-between group-hover:bg-primary group-hover:text-primary-content transition-colors">
                  <span>Configure</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12 flex justify-center"
        >
          <Link href="/doctor/dashboard">
            <button className="btn-primary-cta flex items-center gap-2">
              Go to Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}