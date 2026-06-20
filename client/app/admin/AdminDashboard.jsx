"use client";

import React, { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useDispatch, useSelector } from "react-redux";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Bell, Menu, ChevronRight, Command,
  ExternalLink, LogOut, ChevronDown,
  AreaChart, Terminal, PanelLeftClose, Sun, Moon,
  Activity, MousePointerClick, LayoutGrid, MessageSquare,
  Monitor,
} from "lucide-react";

import {
  ADMIN_DASHBOARD_LINKS,
  ADMIN_DASHBOARD_TOP_RIGHT_LINKS,
  ADMIN_SEARCH_QUICK_AND_PAGE_LINKS,
  ADMIN_PROFILE_LINKS,
} from "../../constants/admin";

import { useRouter, usePathname } from "next/navigation";
import { logout } from "@/store/slices/userSlice";
import { useTheme } from "next-themes";
import { cn } from "@/lib/utils";
import Link from "next/link";
import AdminWelcomePage from "./AdminWelcomePage";

// ─────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────────────────

// Flattened set of every registered sidebar href — built once at module load.
const ADMIN_REGISTERED_PATHS = new Set(
  ADMIN_DASHBOARD_LINKS.flatMap((section) =>
    section.links.map((link) => link.href)
  )
);

// FIX 3: Removed local PROFILE_LINKS constant entirely — data now comes from
//         ADMIN_PROFILE_LINKS in the data file (unified prop shape: name/href/icon).

// ─────────────────────────────────────────────────────────────────────────────
// MEMOISED SUB-COMPONENTS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * NavItem — single child link inside an expanded sidebar section.
 * Reads: link.href, link.icon, link.name
 * FIX 4: Was using <a href={link.link}> and {link.title} / {link.icons}
 *         (old prop names). Now uses <Link href={link.href}> and
 *         link.name / link.icon — matching adminLinks.jsx unified shape.
 */
const NavItem = memo(({ link, isActive }) => (
  <Link
    href={link.href}
    className={cn(
      "flex items-center gap-3 px-4 py-3 text-[10px] font-bold uppercase tracking-wider transition-all",
      isActive
        ? "text-warning translate-x-2 bg-warning/5"
        : "text-base-content/40 hover:text-warning hover:translate-x-1"
    )}
  >
    <span className={isActive ? "scale-110 text-warning" : ""}>{link.icon}</span>
    {link.name}
  </Link>
));
NavItem.displayName = "NavItem";

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

/**
 * SidebarSection — collapsible nav group.
 * Reads: section.title, section.icon, section.links[].href
 * FIX 5: Was reading section.icons (old prop name) → now section.icon.
 * FIX 6: isSectionActive was checking link.link → now checks link.href.
 * FIX 7: Was reading ADMIN_DASHBOARD_LINKS.sidebar (old object shape) —
 *         data is now a flat array, so the map target is correct.
 * FIX 8: Auto-open on active child — useEffect dep was missing isSidebarOpen
 *         causing stale closure; added properly.
 */
const SidebarSection = memo(({ section, isOpen, isSidebarOpen, onToggle, pathname }) => {
  const isParentActive = useMemo(
    () => section.links.some((link) => pathname === link.href),
    [section.links, pathname]
  );

  useEffect(() => {
    if (isParentActive && !isOpen && isSidebarOpen) {
      onToggle(section.title);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isParentActive, isSidebarOpen]);

  return (
    <div className="mb-2">
      <button
        onClick={() => onToggle(section.title)}
        className={cn(
          "w-full flex items-center justify-between p-3 rounded-md transition-all group",
          isOpen || isParentActive
            ? "bg-warning/90 text-warning-content shadow-lg shadow-warning/20"
            : "text-base-content/50 hover:bg-base-300 hover:text-base-content"
        )}
      >
        <div className="flex items-center gap-4">
          {/* FIX 5: section.icon (was section.icons) */}
          <span className={cn(
            "shrink-0 transition-transform group-hover:scale-110",
            isOpen || isParentActive ? "text-warning-content" : "text-warning"
          )}>
            {section.icon}
          </span>
          {isSidebarOpen && (
            <span className="text-[11px] text-left font-bold uppercase tracking-widest">
              {section.title}
            </span>
          )}
        </div>
        {isSidebarOpen && (
          <motion.div animate={{ rotate: isOpen ? 180 : 0 }}>
            <ChevronDown size={14} />
          </motion.div>
        )}
      </button>

      <AnimatePresence>
        {isOpen && isSidebarOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden ml-3 mt-2  l border-warning/20 space-y-1"
          >
            {section.links.map((link, lIdx) => (
              <NavItem
                key={lIdx}
                link={link}
                isActive={pathname === link.href}
              />
            ))}
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

const AdminDashboard = ({ children }) => {
  const { user } = useSelector((state) => state.user);
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();

  const [mounted, setMounted]           = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [openMenus, setOpenMenus]       = useState({});
  const [searchQuery, setSearchQuery]   = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, []);

  // FIX 9: Was reading ADMIN_DASHBOARD_LINKS.sidebar.forEach (old object shape).
  //         Data is now a flat array — use .forEach directly on the array.
  //         Also fixed child check: link.link → link.href.
  useEffect(() => {
    const initialMenus = {};
    ADMIN_DASHBOARD_LINKS.forEach((section) => {
      if (section.links.some((link) => pathname === link.href)) {
        initialMenus[section.title] = true;
      }
    });
    setOpenMenus(initialMenus);
  }, [pathname]);

  // Auto-close sidebar on mobile when route changes
  useEffect(() => {
    if (typeof window !== "undefined" && window.innerWidth < 1024) {
      setIsSidebarOpen(false);
    }
  }, [pathname]);

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setIsSearchOpen((prev) => !prev);
      }
      if (e.key === "Escape") setIsSearchOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/login");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  // FIX 10: roleAvatar now maps admin role correctly.
  //          Old code always fell back to a single hardcoded URL regardless of role.
  const roleAvatar = useMemo(() => {
    const avatars = {
      admin:    "https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_02_48%20AM.png",
      customer: "https://ik.imagekit.io/zxxzgk3iq/Likeson/ChatGPT%20Image%20Feb%209,%202026,%2011_42_20%20AM.png",
    };
    return user?.avatar || avatars[user?.role] || avatars.customer;
  }, [user]);

  // Is the current route part of the registered sidebar navigation?
  const isRegisteredRoute = useMemo(
    () => ADMIN_REGISTERED_PATHS.has(pathname),
    [pathname]
  );

  const breadcrumbLabel = isRegisteredRoute
    ? pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ")
    : "Welcome";

  // FIX 11: Authorization guard — was missing entirely in original component.
  //          Admin shell should only render for role === "admin".
  if (mounted && user?.role !== "admin") {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-base-100 p-6 text-center">
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-error/10 p-8 rounded-3xl border border-error/20"
        >
          <Terminal size={48} className="text-error mx-auto mb-4" />
          <h1 className="text-lg font-black uppercase tracking-widest text-error">Access Denied</h1>
          <p className="text-xs text-base-content/60 mt-2">You do not have admin-level access.</p>
          <button
            onClick={() => router.push("/")}
            className="mt-6 px-6 py-2 border border-error/50 text-error hover:bg-error/10 rounded-lg text-xs font-bold uppercase transition-all"
          >
            Return Home
          </button>
        </motion.div>
      </div>
    );
  }

  // FIX 12: Was returning null while unmounted — causes layout flash.
  //          Render shell immediately; gated elements check `mounted` inline.
  if (!mounted) return null;

  return (
    <div date-theme={"admin"} className="min-h-screen bg-base-100 text-base-content font-poppins selection:bg-warning/30">

      {/* ── Mobile Backdrop ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45] lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* ── Sidebar ──────────────────────────────────────────────────────── */}
      <aside className={cn(
        "fixed left-0 top-0 z-50 h-screen bg-base-200 border-r border-base-300 transition-all duration-500 ease-in-out",
        isSidebarOpen ? "w-72 translate-x-0" : "w-0 -translate-x-full lg:w-4 lg:translate-x-0"
      )}>
        <div className="flex flex-col h-full overflow-hidden">

          {/* Logo & Toggle */}
          <div className="p-6 flex items-center justify-between h-24 border-b border-base-300 shrink-0">
            <AnimatePresence mode="wait">
              {isSidebarOpen && (
                <motion.div
                  initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                >
                  <Link href="/admin/dashboard" className="font-bold text-xl tracking-tighter uppercase hover:text-warning transition-colors">
                    Likeson<span className="text-warning">.in</span>
                  </Link>
                </motion.div>
              )}
            </AnimatePresence>
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="p-2 rounded-sm bg-base-300/50 hover:bg-warning hover:text-warning-content transition-all"
              aria-label="Toggle Sidebar"
            >
              {isSidebarOpen ? <PanelLeftClose size={18} /> : <Menu size={18} />}
            </button>
          </div>

          {/* Nav sections — FIX 7: flat array, no .sidebar key */}
          <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-2 w-full max-w-[300px] custom-scrollbar">
            {ADMIN_DASHBOARD_LINKS.map((section, idx) => (
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

      {/* ── Main Content ─────────────────────────────────────────────────── */}
      <main className={cn(
        "transition-all duration-500 min-h-screen flex flex-col",
        isSidebarOpen ? "lg:ml-72" : "lg:ml-24"
      )}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 flex h-20 w-full items-center justify-between border-b border-base-300 bg-base-100/60 backdrop-blur-2xl px-6 md:px-10">

          <div className="flex items-center gap-8">
            {/* Mobile menu open button (only shown when sidebar is closed) */}
            {!isSidebarOpen && (
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-base-content/50"
              >
                <Menu size={24} />
              </button>
            )}

            {/* Top-right quick-access nav
                FIX 13: Was reading item.icons / item.title / sub.link / sub.icons / sub.title
                         (old prop names). Now reads item.icon / item.name / sub.href / sub.icon / sub.name */}
            <div className="hidden xl:flex items-center gap-8">
              {ADMIN_DASHBOARD_TOP_RIGHT_LINKS.map((item, i) => (
                <div key={i} className="group relative">
                  <button className="flex items-center gap-2 text-[10px] font-bold text-base-content/30 hover:text-warning transition-all uppercase tracking-[0.2em]">
                    {item.icon} {item.name}
                  </button>
                  {item.links && (
                    <div className="absolute left-0 top-full opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 translate-y-2 group-hover:translate-y-0">
                      <div className="w-64 bg-base-200 border border-base-300 p-2 rounded-md shadow-2xl">
                        {item.links.map((sub, si) => (
                          <Link
                            key={si}
                            href={sub.href}
                            className="flex items-center gap-3 p-3 text-[10px] font-bold uppercase tracking-widest text-base-content/50 hover:bg-warning/10 hover:text-warning rounded-sm transition-all"
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

          <div className="flex items-center gap-5">

            {/* Search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              className="flex items-center gap-4 px-5 py-2.5 bg-base-300/30 border border-base-300 rounded-md text-base-content/40 hover:border-warning/50 transition-all group"
            >
              <Search size={16} className="group-hover:text-warning" />
              <span className="text-[10px] font-bold uppercase tracking-widest hidden sm:inline italic">
                Global Search
              </span>
              <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-0.5 rounded bg-base-300 text-[9px] font-bold text-base-content/60">
                ⌘K
              </kbd>
            </button>

            {/* Theme toggle */}
              <ThemeToggle />

            {/* Profile dropdown
                FIX 14: Was using <a href={pl.href}> and {pl.icon} / {pl.name} correctly,
                         but sourcing from local PROFILE_LINKS with wrong hrefs and
                         wrong icon choices. Now uses ADMIN_PROFILE_LINKS from the data file. */}
            <div className="group relative">
              <div className="w-12 h-12 rounded-md bg-gradient-to-tr from-warning to-accent p-[2px] cursor-pointer shadow-xl transition-transform active:scale-95">
                <div className="w-full h-full rounded-md overflow-hidden bg-base-300">
                  <img src={roleAvatar} alt="Admin" className="w-full h-full object-cover" />
                </div>
              </div>
              <div className="absolute right-0 top-full pt-4 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-300 z-50 translate-y-2 group-hover:translate-y-0">
                <div className="w-72 bg-base-200 border border-base-300 rounded-md shadow-2xl p-3 backdrop-blur-xl">
                  <div className="px-5 py-3 border-b border-base-300 mb-2 bg-gradient-to-br from-warning/10 to-transparent rounded-md text-center">
                    <p className="text-xs font-bold uppercase italic tracking-tight truncate">
                      {user?.name || "System Admin"}
                    </p>
                    <p className="text-[10px] text-base-content/60">{user?.email}</p>
                  </div>

                  {ADMIN_PROFILE_LINKS.map((pl, pi) => (
                    <Link
                      key={pi}
                      href={pl.href}
                      className="flex items-center gap-4 px-4 py-3.5 text-[11px] font-bold uppercase text-base-content/60 hover:bg-base-100 hover:text-warning rounded-sm transition-all"
                    >
                      {pl.icon} {pl.name}
                    </Link>
                  ))}

                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center gap-4 px-4 py-4 text-[11px] font-bold text-error border-t border-base-300 mt-2 rounded-sm hover:bg-error/10 uppercase tracking-widest transition-all"
                  >
                    <LogOut size={16} /> Logout
                  </button>
                </div>
              </div>
            </div>
          </div>
        </header>

        {/* ── Page Body ────────────────────────────────────────────────── */}
        <section className="flex-1 w-full max-w-[1700px] mx-auto p-2 space-y-6">

          {/* Quick-access shortcut cards
              FIX 15: Was reading shortcut.link / shortcut.icons / shortcut.title
                       (old prop names). Now reads shortcut.href / shortcut.icon / shortcut.name.
              FIX 16: quickLinks is now an array inside an object — access correctly. */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {ADMIN_SEARCH_QUICK_AND_PAGE_LINKS.quickLinks.map((shortcut, idx) => (
              <Link
                key={idx}
                href={shortcut.href}
                className="flex flex-col items-center justify-center   bg-base-200 border border-base-300 rounded-md hover:border-warning/50 hover:bg-warning/5 transition-all group relative overflow-hidden"
              >
                <div className="absolute top-2 right-3 text-[8px] font-bold text-warning/40 uppercase tracking-tighter">
                  {shortcut.shortcut}
                </div>
                <div className="w-10 h-10 rounded-sm bg-base-100 flex items-center justify-center text-warning group-hover:scale-110 group-hover:bg-warning/10 transition-all shadow-sm">
                  {shortcut.icon}
                </div>
                <span className="mt-3 text-[10px] font-bold uppercase tracking-widest text-base-content/40 group-hover:text-base-content">
                  {shortcut.name}
                </span>
              </Link>
            ))}
          </div>

          {/* Breadcrumb + status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 text-[11px] font-bold uppercase tracking-[0.2em] text-base-content/20">
              <Link href="/admin/dashboard" className="hover:text-warning transition-colors">HOME</Link>
              <ChevronRight size={12} />
              <span className="text-warning italic">
                {breadcrumbLabel || "DASHBOARD"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
              <span className="text-[9px] font-bold text-success uppercase">System Online</span>
            </div>
          </div>

          {/* Content frame */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[1.5rem] border border-base-300 bg-base-200/40 min-h-[100vh] p-2 shadow-inner relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 w-[600px] h-[1000px] bg-warning/5 blur-[150px] rounded-full -z-10 animate-pulse pointer-events-none" />
            {isRegisteredRoute ? children : <AdminWelcomePage />}
          </motion.div>
        </section>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <footer className="p-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6 p-3 border border-base-300 rounded-[1rem] bg-base-200/50 backdrop-blur-md">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-base-100 rounded-md border border-base-300">
                <LayoutGrid size={20} className="text-warning" />
              </div>
              <div>
                <span className="block text-[10px] font-bold text-base-content uppercase tracking-[0.4em]">
                  Operational Terminal
                </span>
                <span className="text-[9px] text-base-content/30 font-bold uppercase tracking-widest">
                  © 2026 Admin Infrastructure 
                </span>
              </div>
            </div>

            <div className="flex flex-wrap justify-center gap-3">
              {[
                { name: "Analytics", icon: <AreaChart size={16} />,  href: "/admin/analytics"               },
                { name: "Live Logs", icon: <Terminal size={16} />,   href: "/admin/logs"                    },
                { name: "Support",   icon: <MessageSquare size={16}/>,href: "/admin/support"                },
              ].map((sc, idx) => (
                <Link
                  key={idx}
                  href={sc.href}
                  className="flex items-center gap-3 px-6 py-3 bg-base-100 border border-base-300 rounded-md hover:border-warning/50 hover:bg-warning/5 transition-all group"
                >
                  <span className="text-warning group-hover:rotate-12 transition-transform">{sc.icon}</span>
                  <span className="text-[10px] font-bold text-base-content/40 group-hover:text-base-content uppercase tracking-widest">
                    {sc.name}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </footer>
      </main>

      {/* ── Search Overlay ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {isSearchOpen && (
          <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[12vh] px-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: -20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -20 }}
              className="relative w-full max-w-3xl bg-base-200 border border-base-300 rounded-[1rem] shadow-2xl overflow-hidden"
            >
              {/* Search input */}
              <div className="p-4 border-b border-base-300 flex items-center gap-6 bg-base-100/50">
                <div className="p-2 bg-warning/10 rounded-md text-warning">
                  <Search size={24} />
                </div>
                <input
                  autoFocus
                  placeholder="EXECUTE SEARCH COMMAND..."
                  className="w-full bg-transparent border-none outline-none text-base-content text-2xl font-bold italic tracking-tighter placeholder:text-base-content/10 uppercase"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  className="text-[10px] font-black bg-base-300 px-3 py-1 rounded-lg uppercase"
                >
                  Esc
                </button>
              </div>

              {/* Results
                  FIX 17: Was reading item.title / item.link / item.icons (old prop names)
                           throughout the search results. Now reads item.name / item.href / item.icon.
                  FIX 18: Was filtering pageLinks only. Now shows quickLinks section first
                           (labelled "Quick Access"), then pageLinks (labelled "All Pages"),
                           both filtered by searchQuery — matching superAdmin search UX. */}
              <div className="max-h-[55vh] overflow-y-auto p-4 space-y-6 custom-scrollbar">

                {/* Quick Links section */}
                {(() => {
                  const filtered = ADMIN_SEARCH_QUICK_AND_PAGE_LINKS.quickLinks.filter(
                    (item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered.length) return null;
                  return (
                    <div>
                      <h3 className="text-[11px] font-bold text-warning tracking-[0.5em] mb-4 uppercase px-2 flex items-center gap-3">
                        <MousePointerClick size={14} /> Quick Access
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filtered.map((item, iIdx) => (
                          <Link
                            key={iIdx}
                            href={item.href}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex items-center justify-between p-4 rounded-[0.75rem] bg-base-300/30 hover:bg-warning/20 group transition-all duration-300"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-md bg-base-100 group-hover:bg-warning-content/20 text-warning transition-colors">
                                {item.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-base-content/70 group-hover:text-warning-content uppercase tracking-tight">
                                  {item.name}
                                </span>
                                <span className="text-[9px] text-base-content/40 truncate w-40">{item.href}</span>
                              </div>
                            </div>
                            {item.shortcut && (
                              <kbd className="text-[9px] font-bold bg-base-300 px-2 py-0.5 rounded text-base-content/40">
                                {item.shortcut}
                              </kbd>
                            )}
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Page Links section */}
                {(() => {
                  const filtered = ADMIN_SEARCH_QUICK_AND_PAGE_LINKS.pageLinks.filter(
                    (item) => item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered.length) return null;
                  return (
                    <div>
                      <h3 className="text-[11px] font-bold text-warning tracking-[0.5em] mb-4 uppercase px-2 flex items-center gap-3">
                        <MousePointerClick size={14} /> All Pages
                      </h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {filtered.map((item, iIdx) => (
                          <Link
                            key={iIdx}
                            href={item.href}
                            onClick={() => setIsSearchOpen(false)}
                            className="flex items-center justify-between p-4 rounded-[0.75rem] bg-base-300/30 hover:bg-warning/20 group transition-all duration-300"
                          >
                            <div className="flex items-center gap-4">
                              <div className="p-2 rounded-md bg-base-100 group-hover:bg-warning-content/20 text-warning transition-colors">
                                {item.icon}
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[12px] font-bold text-base-content/70 group-hover:text-warning-content uppercase tracking-tight">
                                  {item.name}
                                </span>
                                <span className="text-[9px] text-base-content/40 truncate w-40">{item.href}</span>
                              </div>
                            </div>
                            <ExternalLink size={14} className="text-base-content/20 group-hover:text-warning-content transition-all" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Empty state */}
                {searchQuery &&
                  !ADMIN_SEARCH_QUICK_AND_PAGE_LINKS.quickLinks.some((i) =>
                    i.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ) &&
                  !ADMIN_SEARCH_QUICK_AND_PAGE_LINKS.pageLinks.some((i) =>
                    i.name.toLowerCase().includes(searchQuery.toLowerCase())
                  ) && (
                    <p className="text-center text-[11px] font-bold text-base-content/20 uppercase tracking-widest py-8">
                      No results for &quot;{searchQuery}&quot;
                    </p>
                  )}
              </div>

              <div className="p-4 bg-base-300/50 border-t border-base-300 text-center">
                <span className="text-[9px] font-bold text-base-content/30 uppercase tracking-[0.4em]">
                  Press ESC to cancel protocol
                </span>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(AdminDashboard);