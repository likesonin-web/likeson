"use client";

import React, {
  useState,
  useEffect,
  useMemo,
  useCallback,
  memo,
} from "react";
import { useDispatch, useSelector } from "react-redux";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import Link from "next/link";

// Icons
import {
  Search, Bell, Menu, ChevronRight, ChevronDown,
  ExternalLink, LogOut, UserRound, Sun, Moon,
  PanelLeftClose, Settings2, ShieldCheck, Gem,
  ScrollText, Car, Truck, AlertTriangle,
  Activity, Zap, BadgeCheck, Building2,
  Monitor,
} from "lucide-react";

// Local Imports
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  TRANSPORT_PARTNER_LINKS,
  TRANSPORT_PARTNER_TOP_RIGHT,
  TRANSPORT_PARTNER_SEARCH,
} from "@/constants/transport";

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE DROPDOWN LINKS
// ─────────────────────────────────────────────────────────────────────────────
const PROFILE_LINKS = [
  { name: "Agency Profile",    href: "/transport-partner/settings/profile",   icon: <UserRound size={15} /> },
  { name: "KYC / Documents",   href: "/transport-partner/settings/kyc",       icon: <BadgeCheck size={15} /> },
  { name: "Bank Details",      href: "/transport-partner/bank/accounts",      icon: <Gem size={15} /> },
  { name: "Security",          href: "/transport-partner/settings/security",  icon: <ShieldCheck size={15} /> },
  { name: "Activity Logs",     href: "/transport-partner/logs",               icon: <ScrollText size={15} /> },
];

const ThemeToggle = memo(function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

  if (!mounted) {
    // Placeholder keeps layout stable during SSR
    return (
      <div
        className="w-10 h-10 rounded-xl border border-base-300 skeleton"
        aria-hidden="true"
      />
    );
  }

  const cycle = () => {
    if (theme === "system") setTheme("light");
    else if (theme === "light") setTheme("dark");
    else setTheme("system");
  };

  const Icon =
    theme === "system"
      ? Monitor
      : resolvedTheme === "dark"
      ? Moon
      : Sun;

  const label =
    theme === "system"
      ? "System theme — click for Light"
      : theme === "light"
      ? "Light theme — click for Dark"
      : "Dark theme — click for System";

  return (
    <button
      onClick={cycle}
      aria-label={label}
      title={label}
      className="p-2.5 rounded-xl border border-base-300 text-base-content/50 hover:bg-primary/5 hover:text-primary transition-all duration-200"
    >
      <Icon size={18} />
    </button>
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// BELL ANIMATION
// ─────────────────────────────────────────────────────────────────────────────
const bellVariant = {
  ring: {
    rotate: [0, 18, -18, 12, -12, 6, -6, 0],
    transition: { duration: 1.4, repeat: Infinity, repeatDelay: 3 },
  },
  idle: { rotate: 0 },
};

// ─────────────────────────────────────────────────────────────────────────────
// NAV ITEM
// ─────────────────────────────────────────────────────────────────────────────
const NavItem = memo(({ link, isActive }) => (
  <Link
    href={link.link}
    className={cn(
      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-all duration-200",
      isActive
        ? "bg-warning/15 text-warning border border-warning/30 shadow-sm"
        : "text-base-content/40 hover:text-warning hover:bg-warning/8 border border-transparent"
    )}
  >
    <span className={cn("shrink-0 transition-transform duration-200", isActive && "scale-110 text-warning")}>
      {link.icons}
    </span>
    <span className="leading-tight">{link.title}</span>
  </Link>
));
NavItem.displayName = "NavItem";

// ─────────────────────────────────────────────────────────────────────────────
// SIDEBAR SECTION
// ─────────────────────────────────────────────────────────────────────────────
const SidebarSection = memo(({ section, isOpen, isSidebarOpen, onToggle, pathname }) => {
  const isParentActive = useMemo(
    () => section.links.some((l) => pathname === l.link),
    [section.links, pathname]
  );

  useEffect(() => {
    if (isParentActive && !isOpen && isSidebarOpen) onToggle(section.title);
  }, [isParentActive, isSidebarOpen]);

  return (
    <div className="mb-1.5">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between px-3 py-2.5 rounded-xl transition-all duration-200 group",
          isOpen || isParentActive
            ? "bg-warning/10 text-warning"
            : "text-base-content/45 hover:bg-base-300/60 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-3">
          <span className={cn(
            "shrink-0 transition-transform duration-200 group-hover:scale-110",
            (isOpen || isParentActive) && "text-warning"
          )}>
            {section.icons}
          </span>
          {isSidebarOpen && (
            <span className="text-[10px] font-black uppercase tracking-widest text-left">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <ChevronDown
            size={13}
            className={cn("transition-transform duration-300 shrink-0", isOpen && "rotate-180")}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && isSidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden ml-5 mt-1 pl-3 border-l-2 border-warning/20"
          >
            <div className="space-y-0.5 py-1">
              {section.links.map((link, i) => (
                <NavItem key={i} link={link} isActive={pathname === link.link} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SidebarSection.displayName = "SidebarSection";

// ─────────────────────────────────────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
const TransportPartnerDashboard = ({ children }) => {
  const dispatch    = useDispatch();
  const router      = useRouter();
  const pathname    = usePathname();
  const { theme, setTheme } = useTheme();

  const { user }      = useSelector((s) => s.user);
  const unreadCount   = useSelector(selectUnreadCount);

  const [mounted,       setMounted]       = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus,     setOpenMenus]     = useState({});
  const [searchQuery,   setSearchQuery]   = useState("");
  const [isSearchOpen,  setIsSearchOpen]  = useState(false);

  // Init
  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  // Ctrl+K
  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((p) => !p);
      }
      if (e.key === "Escape") setIsSearchOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const roleAvatar = useMemo(() => {
    const fallbacks = {
      transportpartner: "https://api.dicebear.com/9.x/shapes/svg?seed=transport&backgroundColor=f59e0b",
    };
    return user?.avatar || fallbacks[user?.role] || fallbacks.transportpartner;
  }, [user]);

  // Guard
  if (user && user.role !== "transportpartner") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-warning/10 p-8 rounded-3xl border border-warning/25 max-w-sm"
        >
          <Truck size={44} className="text-warning mx-auto mb-4" />
          <h1 className="text-sm font-black uppercase tracking-widest text-warning mb-2">
            Transport Portal Only
          </h1>
          <p className="text-xs text-base-content/50 leading-relaxed">
            This dashboard is restricted to Transport Partner accounts.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-6 border-warning/40 text-warning hover:bg-warning/10 text-xs uppercase tracking-widest font-black"
          >
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

  // Breadcrumb label
  const crumb = pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "DASHBOARD";

  return (
    <div className="min-h-screen bg-base-100 text-base-content">

      {/* ── Mobile backdrop ── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/65 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ══════════════════════════════════════════════════════════════
          SIDEBAR
      ══════════════════════════════════════════════════════════════ */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-base-200 border-r border-base-300 transition-all duration-500 ease-in-out flex flex-col",
        isSidebarOpen ? "w-64 translate-x-0" : "w-0 -translate-x-full lg:w-[72px] lg:translate-x-0"
      )}>

        {/* Logo row */}
        <div className="h-[68px] flex items-center justify-between px-4 border-b border-base-300 shrink-0">
          <AnimatePresence mode="wait">
            {isSidebarOpen && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.18 }}
              >
                <Link href="/transport-partner/dashboard" className="flex items-center gap-2.5 group">
                  {/* Amber dot logo mark */}
                  <span className="w-7 h-7 rounded-lg bg-warning flex items-center justify-center shadow-md shrink-0">
                    <Truck size={15} className="text-white" strokeWidth={2.5} />
                  </span>
                  <div className="leading-tight">
                    <p className="text-[11px] font-black uppercase tracking-tight text-base-content group-hover:text-warning transition-colors">
                      LIKESON
                    </p>
                    <p className="text-[8px] font-bold text-warning/70 uppercase tracking-[0.25em]">
                      Transport
                    </p>
                  </div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>

          <button
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="p-2 rounded-lg bg-base-300/40 hover:bg-warning/10 hover:text-warning transition-all"
            aria-label="Toggle Sidebar"
          >
            {isSidebarOpen ? <PanelLeftClose size={17} /> : <Menu size={17}  className="hidden md:block" />}
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-0.5 custom-scrollbar">
          {TRANSPORT_PARTNER_LINKS.sidebar.map((section, i) => (
            <SidebarSection
              key={i}
              section={section}
              isOpen={!!openMenus[section.title]}
              isSidebarOpen={isSidebarOpen}
              onToggle={toggleMenu}
              pathname={pathname}
            />
          ))}
        </nav>

        {/* Sidebar footer — partner status strip */}
        {isSidebarOpen && (
          <div className="shrink-0 px-4 py-4 border-t border-base-300">
            <div className="flex items-center gap-3 bg-warning/8 border border-warning/20 rounded-xl px-3 py-2.5">
              <span className="w-2 h-2 rounded-full bg-success animate-pulse shrink-0" />
              <div className="overflow-hidden">
                <p className="text-[9px] font-black uppercase tracking-widest text-warning/80 truncate">
                  Agency Active
                </p>
                <p className="text-[8px] text-base-content/35 truncate font-semibold">
                  {user?.name || "Transport Partner"}
                </p>
              </div>
            </div>
          </div>
        )}
      </aside>

      {/* ══════════════════════════════════════════════════════════════
          MAIN VIEWPORT
      ══════════════════════════════════════════════════════════════ */}
      <main className={cn(
        "min-h-screen flex flex-col transition-all duration-500",
        isSidebarOpen ? "lg:ml-64" : "lg:ml-[72px]"
      )}>

        {/* ── HEADER ── */}
        <header className="sticky top-0 z-40 h-[68px] flex items-center justify-between border-b border-base-300 bg-base-100/80 backdrop-blur-xl px-5 lg:px-8 shrink-0">

          {/* Left: hamburger + top-right links */}
          <div className="flex items-center gap-5">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-base-200 rounded-lg transition-colors"
              >
                <Menu size={19} className="md:hidden block" />
              </button>
            )}

            {/* Top-right nav links (desktop) */}
            <div className="hidden xl:flex items-center gap-5">
              {TRANSPORT_PARTNER_TOP_RIGHT.map((group, gi) => (
                <div key={gi} className="group relative">
                  <button className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-base-content/35 hover:text-warning transition-all">
                    <span className="text-warning/60">{group.icons}</span>
                    {group.title}
                  </button>
                  <div className="absolute left-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-250 z-50">
                    <div className="w-52 bg-base-200 border border-base-300 p-1.5 rounded-2xl shadow-2xl">
                      {group.links.map((sub, si) => (
                        <Link
                          key={si}
                          href={sub.link}
                          className="flex items-center gap-3 px-3 py-2.5 text-[10px] font-bold uppercase tracking-widest text-base-content/50 hover:bg-warning/10 hover:text-warning rounded-xl transition-all"
                        >
                          <span className="text-warning/50">{sub.icons}</span>
                          {sub.title}
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Right: search + theme + bell + avatar */}
          <div className="flex items-center gap-3">

            {/* Search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-2.5 px-4 py-2 bg-base-200/60 border border-base-300 rounded-xl text-base-content/35 hover:border-warning/40 hover:text-warning transition-all group"
            >
              <Search size={15} className="group-hover:text-warning transition-colors" />
              <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">
                Search <span className="ml-1 opacity-25">⌘K</span>
              </span>
            </button>

            {/* Theme toggle */}
               <ThemeToggle />

            {/* Notifications */}
            <Link href="/transport-partner/settings/notifications">
              <motion.div whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }} className="relative">
                <button className="p-2.5 rounded-xl border border-base-300 text-base-content/40 hover:bg-warning/8 hover:text-warning hover:border-warning/30 transition-all">
                  <motion.div variants={bellVariant} animate={unreadCount > 0 ? "ring" : "idle"}>
                    <Bell size={17} />
                  </motion.div>
                </button>
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-warning rounded-full border-2 border-base-100 animate-pulse" />
                )}
              </motion.div>
            </Link>

            {/* Profile dropdown */}
            <div className="group relative">
              <div className="w-9 h-9 rounded-xl p-[2px] bg-gradient-to-br from-warning to-warning/60 cursor-pointer hover:scale-105 transition-transform shadow-md">
                <img
                  src={roleAvatar}
                  alt="Profile"
                  className="w-full h-full rounded-[10px] object-cover bg-base-300"
                />
              </div>
              <div className="absolute right-0 top-full pt-3 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-250 z-50">
                <div className="w-60 bg-base-200 border border-base-300 rounded-3xl shadow-2xl p-2 backdrop-blur-2xl">
                  {/* User info */}
                  <div className="px-4 py-3.5 border-b border-base-300 mb-1.5 bg-warning/6 rounded-2xl">
                    <p className="text-xs font-black uppercase tracking-tight truncate text-base-content">
                      {user?.name || "Transport Partner"}
                    </p>
                    <p className="text-[9px] text-warning font-black uppercase tracking-[0.2em] mt-0.5">
                      Agency Owner
                    </p>
                  </div>
                  {PROFILE_LINKS.map((pl, pi) => (
                    <Link
                      key={pi}
                      href={pl.href}
                      className="flex items-center gap-3 px-4 py-2.5 text-[10px] font-bold uppercase tracking-wide text-base-content/55 hover:bg-base-100 hover:text-warning rounded-xl transition-all"
                    >
                      <span className="text-warning/50">{pl.icon}</span>
                      {pl.name}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-[10px] font-black text-error border-t border-base-300 mt-1.5 rounded-xl hover:bg-error/10 uppercase tracking-widest transition-all"
                  >
                    <LogOut size={15} /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── CONTENT AREA ── */}
        <section className="flex-1 w-full max-w-[1600px] mx-auto  p-4">

          {/* Breadcrumb */}
          <div className="mb-5 flex items-center gap-2.5 text-[10px] font-black uppercase tracking-widest text-base-content/25">
            <Link href="/transport-partner/dashboard" className="hover:text-warning transition-colors flex items-center gap-1.5">
              <Truck size={11} />
              Fleet
            </Link>
            <ChevronRight size={11} />
            <span className="text-warning">{crumb}</span>
          </div>

          {/* Page content wrapper */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: "easeOut" }}
            className="relative rounded-[1rem] border border-base-300 bg-base-200/35 min-h-[100vh] p-5 shadow-inner overflow-hidden backdrop-blur-sm"
          >
            {/* Subtle warm glow top-right */}
            <div className="pointer-events-none absolute top-0 right-0 w-[500px] h-[500px] bg-warning/4 blur-[120px] rounded-full" />
            {/* Corner tick marks — industrial feel */}
            <span className="pointer-events-none absolute top-4 left-4 w-3 h-3 border-t-2 border-l-2 border-warning/20 rounded-tl-sm" />
            <span className="pointer-events-none absolute top-4 right-4 w-3 h-3 border-t-2 border-r-2 border-warning/20 rounded-tr-sm" />
            <span className="pointer-events-none absolute bottom-4 left-4 w-3 h-3 border-b-2 border-l-2 border-warning/20 rounded-bl-sm" />
            <span className="pointer-events-none absolute bottom-4 right-4 w-3 h-3 border-b-2 border-r-2 border-warning/20 rounded-br-sm" />

            {children}
          </motion.div>
        </section>

        {/* ── FOOTER ── */}
        <footer className="px-5 lg:px-7 pb-6 shrink-0">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-5 p-5 border border-base-300 rounded-[1.75rem] bg-base-200/45">
            {/* Brand */}
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-warning/12 border border-warning/20 flex items-center justify-center">
                <Truck size={18} className="text-warning" />
              </div>
              <div>
                <p className="text-[9px] font-black uppercase tracking-[0.3em] text-base-content/50">
                  Likeson Transport
                </p>
                <p className="text-[8px] font-bold text-base-content/25 uppercase tracking-widest">
                  Partner Portal  
                </p>
              </div>
            </div>

            {/* Quick footer links */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 w-full xl:w-auto">
              {[
                { title: "Fleet",     link: "/transport-partner/fleet/vehicles",  icon: <Car size={16} /> },
                { title: "Drivers",   link: "/transport-partner/drivers",          icon: <Truck size={16} /> },
                { title: "Zones",     link: "/transport-partner/zones",            icon: <Activity size={16} /> },
                { title: "Logs",      link: "/transport-partner/logs",             icon: <ScrollText size={16} /> },
              ].map((item, i) => (
                <Link
                  key={i}
                  href={item.link}
                  className="flex items-center gap-3 px-4 py-3 bg-base-100/50 border border-base-300 rounded-xl hover:border-warning/40 hover:bg-warning/6 transition-all group"
                >
                  <span className="text-warning/50 group-hover:text-warning transition-colors group-hover:scale-110 transform">
                    {item.icon}
                  </span>
                  <span className="text-[9px] font-black text-base-content/40 group-hover:text-base-content uppercase tracking-widest">
                    {item.title}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ══════════════════════════════════════════════════════════════
          SEARCH OVERLAY
      ══════════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[14vh] px-4">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-lg"
            />

            {/* Panel */}
            <motion.div
              initial={{ opacity: 0, y: -18, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -18, scale: 0.97 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative w-full max-w-xl bg-base-200 border border-base-300 rounded-[2rem] shadow-[0_0_60px_-10px_rgba(0,0,0,0.6)] overflow-hidden"
            >
              {/* Search input row */}
              <div className="flex items-center gap-4 px-7 py-5 border-b border-base-300 bg-base-100/50">
                <Search size={20} className="text-warning shrink-0" />
                <input
                  autoFocus
                  placeholder="Search fleet, drivers, zones..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent border-none outline-none text-base-content text-sm font-bold placeholder:text-base-content/25 placeholder:font-normal"
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[9px] font-black bg-base-300 px-3 py-1 rounded-lg uppercase tracking-widest text-base-content/40 hover:text-base-content transition-colors shrink-0"
                >
                  Esc
                </button>
              </div>

              {/* Results */}
              <div className="max-h-[52vh] overflow-y-auto p-5 custom-scrollbar">

                {/* Quick links (only show when no query) */}
                {!searchQuery && (
                  <div className="mb-6">
                    <p className="text-[9px] font-black text-warning/70 tracking-[0.3em] uppercase px-2 mb-3">
                      Quick Access
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {TRANSPORT_PARTNER_SEARCH.quickLinks.map((ql, i) => (
                        <Link
                          key={i}
                          href={ql.link}
                          onClick={() => setIsSearchOpen(false)}
                          className="flex items-center gap-3 p-3.5 rounded-2xl bg-base-100/60 border border-base-300 hover:border-warning/35 hover:bg-warning/8 group transition-all"
                        >
                          <span className="text-warning/50 group-hover:text-warning transition-colors">
                            {ql.icons}
                          </span>
                          <div>
                            <p className="text-[10px] font-bold text-base-content/70 group-hover:text-base-content uppercase tracking-tight">
                              {ql.title}
                            </p>
                            <p className="text-[8px] font-black text-warning/40 tracking-widest mt-0.5">
                              {ql.shortcut}
                            </p>
                          </div>
                        </Link>
                      ))}
                    </div>
                  </div>
                )}

                {/* Filtered page links */}
                {(() => {
                  const filtered = TRANSPORT_PARTNER_SEARCH.pageLinks.filter((l) =>
                    l.title.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered.length) return (
                    <div className="text-center py-10">
                      <p className="text-[10px] font-black text-base-content/20 uppercase tracking-widest">
                        No results for "{searchQuery}"
                      </p>
                    </div>
                  );
                  return (
                    <div>
                      {searchQuery && (
                        <p className="text-[9px] font-black text-warning/70 tracking-[0.3em] uppercase px-2 mb-3">
                          Pages
                        </p>
                      )}
                      <div className="space-y-0.5">
                        {filtered.map((item, i) => (
                          <Link
                            key={i}
                            href={item.link}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex items-center justify-between px-4 py-3 rounded-xl hover:bg-warning/8 group transition-all"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-base-content/30 group-hover:text-warning transition-colors">
                                {item.icons}
                              </span>
                              <span className="text-[11px] font-bold text-base-content/60 group-hover:text-base-content uppercase tracking-tight">
                                {item.title}
                              </span>
                            </div>
                            <ExternalLink
                              size={13}
                              className="opacity-0 group-hover:opacity-100 text-warning/60 transition-all"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(TransportPartnerDashboard);