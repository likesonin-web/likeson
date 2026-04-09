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
  Search,
  Bell,
  Menu,
  ChevronRight,
  Command,
  ExternalLink,
  LogOut,
  ChevronDown,
  PanelLeftClose,
  Sun,
  Moon,
  Car,
  ShieldAlert,
  Monitor,
} from "lucide-react";

// Local Imports
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  SOLO_DRIVER_PARTNER_LINKS,
  SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS,
  SOLO_DRIVER_PARTNER_SEARCH_LINKS,
  SOLO_DRIVER_PARTNER_PROFILE_LINKS,
  SOLO_DRIVER_PARTNER_SHORTCUTS,
} from "../../constants/Solodriverpartnerlinks"; // adjust path as needed

// ─── Bell Animation ────────────────────────────────────────────────────────────
const bellRingingVariant = {
  ring: {
    rotate: [0, 15, -15, 10, -10, 5, -5, 0],
    transition: { duration: 1.5, repeat: Infinity, repeatDelay: 2 },
  },
  idle: { rotate: 0 },
};
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

// ─── NavItem ──────────────────────────────────────────────────────────────────
const NavItem = memo(({ link, isActive }) => (
  <Link
    href={link.href}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase transition-all duration-200 rounded-lg",
      isActive
        ? "text-primary bg-primary/5 shadow-sm"
        : "text-base-content/40 hover:text-primary hover:bg-base-300"
    )}
  >
    <span className={cn("transition-transform duration-200", isActive && "scale-110")}>
      {link.icon}
    </span>
    {link.name}
  </Link>
));
NavItem.displayName = "NavItem";

// ─── SidebarSection ───────────────────────────────────────────────────────────
const SidebarSection = memo(({ section, isOpen, isSidebarOpen, onToggle, pathname }) => {
  const isParentActive = useMemo(
    () => section.links.some((link) => pathname === link.href),
    [section.links, pathname]
  );

  useEffect(() => {
    if (isParentActive && !isOpen && isSidebarOpen) {
      onToggle(section.title);
    }
  }, [isParentActive, isSidebarOpen]);

  return (
    <div className="mb-2">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-xl transition-all group",
          isOpen || isParentActive
            ? "bg-primary/10 text-primary"
            : "text-base-content/50 hover:bg-base-300 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-4">
          <span
            className={cn(
              "shrink-0 transition-transform group-hover:scale-110",
              (isOpen || isParentActive) && "text-primary"
            )}
          >
            {section.icons}
          </span>
          {isSidebarOpen && (
            <span className="text-[11px] text-left font-bold uppercase tracking-tight">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <ChevronDown
            size={14}
            className={cn("transition-transform duration-300", isOpen && "rotate-180")}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && isSidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-6 mt-1 border-l border-base-300"
          >
            {section.links.map((link, idx) => (
              <NavItem key={idx} link={link} isActive={pathname === link.href} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SidebarSection.displayName = "SidebarSection";

// ─── Main Component ───────────────────────────────────────────────────────────
const SoloDriverDashboard = ({ children }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const { user } = useSelector((state) => state.user);
  const unreadCount = useSelector(selectUnreadCount);

  const [mounted, setMounted] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  // ── Keyboard Shortcut: Cmd/Ctrl + K ────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  // ── Driver avatar fallback ──────────────────────────────────────────────────
  const driverAvatar = useMemo(() => {
    return (
      user?.avatar ||
      "https://api.dicebear.com/7.x/avataaars/svg?seed=SoloDriver&backgroundColor=b6e3f4"
    );
  }, [user]);

  // ── Authorization Guard ─────────────────────────────────────────────────────
  // Allow solo_driver role (adjust the role string to match your system)
  if (user?.role !== "solodriverpartner") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-error/10 p-8 rounded-3xl border border-error/20"
        >
          <ShieldAlert size={48} className="text-error mx-auto mb-4" />
          <h1 className="text-lg font-black uppercase tracking-widest text-error">Access Denied</h1>
          <p className="text-xs text-base-content/60 mt-2">
            This portal is restricted to Solo Driver Partners.
          </p>
          <Button
            onClick={() => router.push("/")}
            variant="outline"
            className="mt-6 border-error/50 text-error hover:bg-error/10"
          >
            Return Home
          </Button>
        </motion.div>
      </div>
    );
  }

  // ── Flatten search links for filtering ─────────────────────────────────────
  // SOLO_DRIVER_PARTNER_SEARCH_LINKS is an array of two arrays:
  // [frequentItems[], quickActionItems[]]
  const searchSections = useMemo(
    () => [
      { label: "Frequently Visited", items: SOLO_DRIVER_PARTNER_SEARCH_LINKS[0] },
      { label: "Quick Actions",      items: SOLO_DRIVER_PARTNER_SEARCH_LINKS[1] },
    ],
    []
  );

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-base-100 text-base-content selection:bg-primary/30">

      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-50 h-screen bg-base-200 border-r border-base-300 transition-all duration-500 ease-in-out",
          isSidebarOpen
            ? "w-64 translate-x-0"
            : "w-0 -translate-x-full lg:w-20 lg:translate-x-0"
        )}
      >
        <div className="flex flex-col h-full overflow-hidden">
          {/* Logo / Toggle */}
          <div className="p-6 flex items-center justify-between h-20 border-b border-base-300">
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <Link
                    href="/partner/solo/dashboard"
                    className="font-black text-xl tracking-tighter hover:text-primary transition-colors flex items-center gap-2"
                  >
                    <Car size={20} className="text-primary" />
                    SOLO<span className="text-secondary">.drive</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-lg bg-base-300/50 hover:text-primary transition-all"
              aria-label="Toggle Sidebar"
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {/* Nav */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1 custom-scrollbar">
            {SOLO_DRIVER_PARTNER_LINKS.map((section, idx) => (
              <SidebarSection
                key={idx}
                section={section}
                isOpen={openMenus[section.title]}
                isSidebarOpen={isSidebarOpen}
                onToggle={toggleMenu}
                pathname={pathname}
              />
            ))}
          </nav>
        </div>
      </aside>

      {/* ── Main Viewport ── */}
      <main className={cn("transition-all duration-500", isSidebarOpen ? "lg:ml-64" : "lg:ml-20")}>

        {/* Global Header */}
        <header className="sticky top-0 z-40 flex h-20 w-full items-center justify-between border-b border-base-300 bg-base-100/70 backdrop-blur-xl px-6 lg:px-10">
          <div className="flex items-center gap-4">
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-base-200 rounded-lg"
              >
                <Menu size={20} />
              </button>
            )}

            {/* Top-right quick links (shown in header left on desktop) */}
            <div className="hidden xl:flex items-center gap-6">
              {SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS.map((item, i) => (
                <div key={i} className="group relative">
                  <button className="flex items-center gap-2 text-[10px] font-black text-base-content/40 hover:text-primary transition-all uppercase tracking-widest">
                    {item.icon} {item.name}
                  </button>
                  {item.links && (
                    <div className="absolute left-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300">
                      <div className="w-56 bg-base-200 border border-base-300 p-2 rounded-2xl shadow-2xl">
                        {item.links.map((sub, si) => (
                          <Link
                            key={si}
                            href={sub.href}
                            className="flex items-center gap-3 p-3 text-[10px] font-bold uppercase text-base-content/50 hover:bg-primary/10 hover:text-primary rounded-xl transition-all"
                          >
                            {sub.icon} {sub.name}
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-5">
            {/* Command Search */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-3 px-4 py-2 bg-base-200/50 border border-base-300 rounded-xl text-base-content/40 hover:border-primary/50 transition-all group"
            >
              <Search size={16} className="group-hover:text-primary" />
              <span className="text-[9px] font-black uppercase tracking-widest hidden md:inline">
                Search <span className="ml-2 opacity-30">⌘K</span>
              </span>
            </button>

            {/* Theme Toggle */}
           <ThemeToggle/>

            {/* Notifications */}
            <Link href="/partner/solo/notifications">
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="relative">
                <Button variant="ghost" size="icon" className="rounded-xl text-base-content/60 hover:bg-base-200">
                  <motion.div
                    variants={bellRingingVariant}
                    animate={unreadCount > 0 ? "ring" : "idle"}
                  >
                    <Bell size={20} />
                  </motion.div>
                  {unreadCount > 0 && (
                    <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-primary rounded-full border-2 border-base-100 animate-pulse" />
                  )}
                </Button>
              </motion.div>
            </Link>

            {/* Profile Menu */}
            <div className="group relative">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-primary to-primary-focus p-[2px] cursor-pointer shadow-xl transition-transform hover:scale-105">
                <img
                  src={driverAvatar}
                  alt="Driver Profile"
                  className="w-full h-full rounded-[10px] object-cover bg-base-300"
                />
              </div>
              <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50">
                <div className="w-64 bg-base-200 border border-base-300 rounded-3xl shadow-2xl p-2 backdrop-blur-2xl">
                  <div className="px-4 py-4 border-b border-base-300 mb-2 bg-primary/5 rounded-2xl">
                    <p className="text-xs font-black uppercase tracking-tight truncate">
                      {user?.name || "Driver Partner"}
                    </p>
                    <p className="text-[9px] text-primary font-black uppercase mt-1 tracking-[0.2em]">
                      Solo Driver Partner
                    </p>
                  </div>
                  {SOLO_DRIVER_PARTNER_PROFILE_LINKS.map((pl, pi) => (
                    <Link
                      key={pi}
                      href={pl.href}
                      className="flex items-center gap-3 px-4 py-3 text-[11px] font-bold uppercase text-base-content/60 hover:bg-base-100 hover:text-primary rounded-xl transition-all"
                    >
                      {pl.icon} {pl.name}
                    </Link>
                  ))}
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-3 text-[11px] font-black text-error border-t border-base-300 mt-2 rounded-xl hover:bg-error/10 uppercase tracking-widest"
                  >
                    <LogOut size={16} /> Sign Out
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Content Area */}
        <section className="flex-1 w-full max-w-[1600px] mx-auto p-4">
          {/* Breadcrumbs */}
          <div className="mb-6 flex items-center gap-3 text-[11px] font-black uppercase tracking-widest text-base-content/20">
            <Link href="/partner/solo/dashboard" className="hover:text-primary transition-colors">
              Home
            </Link>
            <ChevronRight size={12} />
            <span className="text-primary">
              {pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard"}
            </span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[2.5rem] border border-base-300 bg-base-200/40 min-h-[75vh] p-4 shadow-inner relative overflow-hidden backdrop-blur-sm"
          >
            {/* Visual Flare */}
            <div className="absolute rounded-[2.5rem] top-0 right-0 w-[600px] h-[600px] bg-primary/5 blur-[150px] rounded-full pointer-events-none" />
            {children}
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="p-6">
          <div className="flex flex-col xl:flex-row items-center justify-between gap-6 p-6 border border-base-300 rounded-[2rem] bg-base-200/50">
            <div className="flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Car size={20} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-base-content/60">
                  Solo Driver Partner Portal
                </p>
                <p className="text-[9px] font-bold text-base-content/20 uppercase">
                  Likeson.in 
                </p>
              </div>
            </div>

            {/* Keyboard Shortcuts Display */}
            <div className="flex flex-wrap items-center gap-3">
              {SOLO_DRIVER_PARTNER_SHORTCUTS.map((sc, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-2 px-4 py-3 bg-base-100/50 border border-base-300 rounded-2xl"
                >
                  <Command size={14} className="text-primary" />
                  <span className="text-[9px] font-black text-base-content/40 uppercase tracking-widest">
                    {sc.name}
                  </span>
                  <kbd className="text-[9px] font-mono bg-base-300 px-2 py-0.5 rounded text-base-content/50">
                    {sc.keys}
                  </kbd>
                </div>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ── Command / Search Overlay ── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-lg"
            />
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.98 }}
              className="relative w-full max-w-2xl bg-base-200 border border-base-300 rounded-[2.5rem] shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden"
            >
              <div className="p-8 border-b border-base-300 flex items-center gap-6 bg-base-100/50">
                <Search className="text-primary" size={24} />
                <input
                  autoFocus
                  placeholder="Search pages & actions..."
                  className="w-full bg-transparent border-none outline-none text-base-content text-lg font-black tracking-tight placeholder:text-base-content/20 uppercase"
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[10px] font-black bg-base-300 px-3 py-1 rounded-lg uppercase"
                >
                  Esc
                </button>
              </div>

              <div className="max-h-[50vh] overflow-y-auto p-6 space-y-8 custom-scrollbar">
                {searchSections.map(({ label, items }) => {
                  const filtered = items?.filter((item) =>
                    item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered || filtered.length === 0) return null;

                  return (
                    <div key={label}>
                      <h3 className="text-[10px] font-black text-primary tracking-[0.3em] mb-4 uppercase px-2">
                        {label}
                      </h3>
                      <div className="space-y-1">
                        {filtered.map((item, iIdx) => (
                          <Link
                            key={iIdx}
                            href={item.href}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex items-center justify-between p-4 rounded-2xl hover:bg-primary/10 group transition-all"
                          >
                            <div className="flex items-center gap-4">
                              <span className="text-base-content/30 group-hover:text-primary transition-colors">
                                {item.icon}
                              </span>
                              <span className="text-xs font-bold text-base-content/70 group-hover:text-base-content uppercase tracking-tight">
                                {item.name}
                              </span>
                            </div>
                            <ExternalLink
                              size={14}
                              className="opacity-0 group-hover:opacity-100 text-primary transition-all"
                            />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(SoloDriverDashboard);