'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { useDispatch, useSelector } from 'react-redux';
import { 
  Building2, FileText, Clock, Users, 
  ArrowRight, PlusCircle, AlertCircle 
} from 'lucide-react';
import { 
  fetchMyManagedHospitals, 
  selectMyManagedHospitals 
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

export default function WelcomeHospitalPage() {
  const dispatch = useDispatch();
  const managedHospitalsData = useSelector(selectMyManagedHospitals);

  useEffect(() => {
    dispatch(fetchMyManagedHospitals());
  }, [dispatch]);

  // Safely extract the primary managed hospital's name
  const hospitalList = managedHospitalsData?.managedHospitals || [];
  const hospitalName = hospitalList.length > 0 
    ? hospitalList[0].name 
    : 'Your Healthcare Facility';

  const steps = [
    {
      id: 1,
      title: 'Facility Details',
      description: 'Upload your hospital logo, gallery images, and outline your core specialties and facilities.',
      icon: <Building2 className="w-8 h-8 text-primary" />,
      href: '/hospital/settings/profile',
    },
    {
      id: 2,
      title: 'Registration & Legal',
      description: 'Verify your medical licenses, GST, and PAN details to activate your hospital profile.',
      icon: <FileText className="w-8 h-8 text-secondary" />,
      href: '/hospital/settings/security',
    },
    {
      id: 3,
      title: 'Pricing & Hours',
      description: 'Set your global consultation fees, emergency availability, and standard operating hours.',
      icon: <Clock className="w-8 h-8 text-accent" />,
      href: '/hospital/settings/pricing',
    },
    {
      id: 4,
      title: 'Link Doctors',
      description: 'Add and manage doctors affiliated with your hospital to start accepting appointments.',
      icon: <Users className="w-8 h-8 text-info" />,
      href: '/hospital/doctors/manage',
    },
  ];

  return (
    <div data-theme="hospital" className="min-h-screen bg-base-100 safe-top safe-bottom py-12">
      <div className="container-custom py-10 max-w-6xl">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={containerVariants}
          className="flex flex-col items-center text-center mb-12"
        >
          <motion.div variants={itemVariants} className="badge badge-secondary mb-4">
            Hospital Management
          </motion.div>
          <motion.h1 variants={itemVariants} className="section-heading">
            Welcome to Likeson, <span className="text-gradient-primary">{hospitalName}</span>
          </motion.h1>
          <motion.p variants={itemVariants} className="section-subheading max-w-2xl mx-auto mt-4">
            Prepare your facility for patients. Complete the onboarding steps below to unlock your hospital dashboard and start managing your medical staff.
          </motion.p>

          {/* Quick Actions */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-3 mt-6">
            <Link href="/hospital/doctors/add">
              <button className="btn btn-primary btn-sm">
                <PlusCircle className="w-4 h-4" /> Add New Doctor
              </button>
            </Link>
            <button className="btn btn-error btn-sm btn-outline">
              <AlertCircle className="w-4 h-4" /> Update Emergency Status
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
            <motion.div key={step.id} variants={itemVariants} className="card bg-base-100 hover-glow-primary flex flex-col h-full p-6 relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-24 h-24 bg-primary/5 rounded-full blur-2xl group-hover:bg-primary/10 transition-colors" />
              
              <div className="flex-1 relative z-10">
                <div className="w-12 h-12 rounded bg-base-200 border border-base-300 flex items-center justify-center mb-6">
                  {step.icon}
                </div>
                <h3 className="text-responsive-base font-bold text-base-content mb-2 font-montserrat">
                  {step.id}. {step.title}
                </h3>
                <p className="text-sm text-base-content/70 font-poppins mb-6">
                  {step.description}
                </p>
              </div>

              <Link href={step.href} className="mt-auto relative z-10">
                <button className="btn btn-ghost w-full justify-between border border-base-300 hover:border-primary">
                  <span className="font-semibold text-primary">Setup Now</span>
                  <ArrowRight className="w-4 h-4 text-primary" />
                </button>
              </Link>
            </motion.div>
          ))}
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.5 }}
          className="mt-12 flex flex-col sm:flex-row gap-4 justify-center items-center"
        >
          <Link href="/hospital/dashboard">
            <button className="btn-primary-cta flex items-center gap-2 w-full sm:w-auto">
              Enter Dashboard <ArrowRight className="w-5 h-5" />
            </button>
          </Link>
          <Link href="/hospital/support">
            <button className="btn btn-outline flex items-center gap-2 w-full sm:w-auto px-6 py-3 h-auto">
              Need Help?
            </button>
          </Link>
        </motion.div>
      </div>
    </div>
  );
}