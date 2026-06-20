"use client";

import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  ShieldCheck,
  Users,
  Activity,
  Settings2,
  BarChart3,
  ArrowRight,
  Server,
  Database,
  Wallet,
} from "lucide-react";
import { getProfile } from "@/store/slices/userSlice";

const AdminWelcomePage = () => {
  const dispatch = useDispatch();
  const { user, loaders } = useSelector((state) => state.user);

  useEffect(() => {
    dispatch(getProfile());
  }, [dispatch]);

  const firstName = user?.name?.split(" ")[0] ?? "Admin";
  const profileLoading = loaders?.profile;

  const greeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 17) return "Good afternoon";
    return "Good evening";
  };

  return (
    <div className=" p-3">
      {/* ── Hero ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6 mb-8"
      >
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-warning mb-2 italic">
            {greeting()}
          </p>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black tracking-tighter mb-2 uppercase">
            Welcome back, {profileLoading ? "..." : firstName}
          </h1>
          <p className="text-xs sm:text-sm text-base-content/50 max-w-xl font-semibold">
            Here&rsquo;s a quick overview of how the Likeson platform is
            running across consultations, diagnostics, pharmacy, and
            transport.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/admin/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-md bg-warning text-warning-content font-bold text-[10px] uppercase tracking-widest shadow-xl hover:scale-[1.03] transition-transform"
          >
            Open Dashboard
            <ArrowRight size={14} />
          </Link>
          <Link
            href="/admin/settings"
            className="flex items-center justify-center gap-2 px-6 py-3 rounded-md border border-base-300 text-base-content/60 font-bold text-[10px] uppercase tracking-widest hover:border-warning/50 hover:text-warning transition-all"
          >
            <Settings2 size={14} />
            Settings
          </Link>
        </div>
      </motion.div>

      {/* ── Stat grid ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.1, ease: "easeOut" }}
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10"
      >
        {[
          { label: "Platform Status", value: "Operational", icon: <Server size={18} />, color: "text-warning", bg: "bg-warning/10" },
          { label: "API Health",      value: "Stable",      icon: <Activity size={18} />, color: "text-success", bg: "bg-success/10" },
          { label: "Database",        value: "Connected",   icon: <Database size={18} />, color: "text-accent", bg: "bg-accent/10" },
          { label: "Payments",        value: "Active",      icon: <Wallet size={18} />,    color: "text-info", bg: "bg-info/10" },
        ].map((stat, idx) => (
          <div
            key={idx}
            className="p-5 rounded-md border border-base-300 bg-base-200/50 hover:border-warning/30 transition-all"
          >
            <div className={`w-9 h-9 rounded-md flex items-center justify-center mb-3 ${stat.bg} ${stat.color}`}>
              {stat.icon}
            </div>
            <div className="text-lg font-black tracking-tight">{stat.value}</div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-base-content/30 mt-1">
              {stat.label}
            </div>
          </div>
        ))}
      </motion.div>

      {/* ── Quick actions ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2, ease: "easeOut" }}
      >
        <h2 className="text-[10px] font-bold uppercase tracking-[0.3em] text-base-content/30 mb-4">
          Quick Actions
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              title: "User Directory",
              desc: "Review customer and partner accounts, and manage access across the platform.",
              icon: <Users size={18} />,
              color: "text-warning",
              bg: "bg-warning/10",
              href: "/admin/users",
              cta: "Manage Users",
            },
            {
              title: "Analytics",
              desc: "Track bookings, revenue, and engagement trends across every vertical.",
              icon: <BarChart3 size={18} />,
              color: "text-success",
              bg: "bg-success/10",
              href: "/admin/analytics",
              cta: "View Reports",
            },
            {
              title: "System Settings",
              desc: "Adjust workspace-level settings, security policies, and integrations.",
              icon: <ShieldCheck size={18} />,
              color: "text-accent",
              bg: "bg-accent/10",
              href: "/admin/settings",
              cta: "Open Settings",
            },
          ].map((card, idx) => (
            <div
              key={idx}
              className="p-6 rounded-md border border-base-300 bg-base-200/50 hover:border-warning/30 hover:shadow-lg transition-all flex flex-col"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-md flex items-center justify-center ${card.bg} ${card.color}`}>
                  {card.icon}
                </div>
                <h4 className="font-black text-sm tracking-tight uppercase">{card.title}</h4>
              </div>
              <p className="text-xs text-base-content/50 font-semibold mb-5 flex-1">
                {card.desc}
              </p>
              <Link
                href={card.href}
                className={`inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${card.color} hover:gap-3 transition-all`}
              >
                {card.cta}
                <ArrowRight size={14} />
              </Link>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};

export default AdminWelcomePage;