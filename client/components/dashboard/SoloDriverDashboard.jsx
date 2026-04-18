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
import Link from "next/link";

import {
  Search,
  Bell,
  Menu,
  ChevronRight,
  ChevronDown,
  ExternalLink,
  LogOut,
  PanelLeftClose,
  Sun,
  Moon,
  Car,
  ShieldAlert,
  UserRound,
  X,
} from "lucide-react";
 
import { logout } from "@/store/slices/userSlice";
import { fetchNotifications, selectUnreadCount } from "@/store/slices/notificationSlice";
import {
  SOLO_DRIVER_PARTNER_LINKS,
  SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS,
  SOLO_DRIVER_PARTNER_SEARCH_LINKS,
  SOLO_DRIVER_PARTNER_PROFILE_LINKS,
  SOLO_DRIVER_PARTNER_SHORTCUTS,
} from "../../constants/Solodriverpartnerlinks.js";

// ─── Theme Toggle ─────────────────────────────────────────────────────────────
const ThemeToggle = memo(function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem("partner_theme");
      const dark = saved === "dark";
      setIsDark(dark);
      document.documentElement.classList.toggle("dark", dark);
    } catch (_) {}
  }, []);

  const toggle = useCallback(() => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("partner_theme", next ? "dark" : "light");
    } catch (_) {}
  }, [isDark]);

  if (!mounted)
    return (
      <div
        className="skeleton"
        style={{ width: 36, height: 36, borderRadius: "0.75rem", flexShrink: 0 }}
      />
    );

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="dp-theme-btn"
    >
      {isDark ? <Moon size={15} /> : <Sun size={15} />}
    </button>
  );
});

// ─── NavItem ──────────────────────────────────────────────────────────────────
const NavItem = memo(({ link, isActive }) => (
  <Link href={link.href} className={`dp-nav-item${isActive ? " dp-nav-item--active" : ""}`}>
    <span style={{ flexShrink: 0, opacity: 0.7 }}>{link.icon}</span>
    <span className="dp-nav-label">{link.name}</span>
  </Link>
));
NavItem.displayName = "NavItem";

// ─── SidebarSection ───────────────────────────────────────────────────────────
const SidebarSection = memo(({ section, isOpen, expanded, onToggle, pathname }) => {
  const isParentActive = useMemo(
    () => section.links.some((l) => pathname === l.href),
    [section.links, pathname]
  );

  useEffect(() => {
    if (isParentActive && !isOpen && expanded) onToggle(section.title);
  }, [isParentActive, expanded]);

  const active = isOpen || isParentActive;

  return (
    <div style={{ marginBottom: 2 }}>
      <button
        onClick={() => onToggle(section.title)}
        className={`dp-section-btn${active ? " dp-section-btn--active" : ""}`}
        title={!expanded ? section.title : undefined}
      >
        <div className="dp-section-inner">
          <span className="dp-section-icon">{section.icons}</span>
          {expanded && <span className="dp-section-title">{section.title}</span>}
        </div>
        {expanded && (
          <ChevronDown
            size={12}
            style={{
              flexShrink: 0,
              transition: "transform 0.25s",
              transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
            }}
          />
        )}
      </button>

      <AnimatePresence>
        {isOpen && expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="dp-submenu"
          >
            {section.links.map((link, i) => (
              <NavItem key={i} link={link} isActive={pathname === link.href} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
SidebarSection.displayName = "SidebarSection";

// ─── Shared Sidebar Body ──────────────────────────────────────────────────────
const SidebarBody = memo(function SidebarBody({
  expanded,
  openMenus,
  toggleMenu,
  pathname,
  user,
  driverAvatar,
  onClose,
  onDesktopToggle,
}) {
  return (
    <>
      {/* Header row */}
      <div className="dp-sidebar-hdr">
        <AnimatePresence mode="wait">
          {expanded && (
            <motion.div
              key="logo"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              style={{ flex: 1, minWidth: 0 }}
            >
              <Link href="/partner/solo/dashboard" className="dp-logo">
                <span className="dp-logo-icon">
                  <Car size={15} style={{ color: "#fff" }} />
                </span>
                <span>
                  DRIVE<span style={{ color: "var(--secondary)" }}>PARTNER</span>
                </span>
              </Link>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Collapsed center icon — desktop only */}
        {!expanded && !onClose && (
          <div className="dp-logo-icon" style={{ margin: "0 auto" }}>
            <Car size={15} style={{ color: "#fff" }} />
          </div>
        )}

        {/* Mobile: close button */}
        {onClose && (
          <button onClick={onClose} className="dp-icon-btn" aria-label="Close menu">
            <X size={15} />
          </button>
        )}

        {/* Desktop: collapse/expand toggle */}
        {onDesktopToggle && (
          <button onClick={onDesktopToggle} className="dp-icon-btn" aria-label="Toggle sidebar">
            {expanded ? <PanelLeftClose size={15} /> : <Menu size={15} />}
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="dp-sidebar-nav">
        {SOLO_DRIVER_PARTNER_LINKS.map((section, i) => (
          <SidebarSection
            key={i}
            section={section}
            isOpen={!!openMenus[section.title]}
            expanded={expanded}
            onToggle={toggleMenu}
            pathname={pathname}
          />
        ))}
      </nav>

      {/* User strip */}
      {expanded && (
        <div className="dp-user-strip">
          <div className="dp-user-inner">
            <img src={driverAvatar} alt="avatar" className="dp-avatar" />
            <div style={{ minWidth: 0, flex: 1 }}>
              <p className="dp-user-name">{user?.name || "Driver Partner"}</p>
              <p className="dp-user-role">Driver Partner</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
});

// ─── Main Layout ──────────────────────────────────────────────────────────────
const SoloDriverPartnerDashboard = ({ children }) => {
  const dispatch = useDispatch();
  const router = useRouter();
  const pathname = usePathname();

  const { user } = useSelector((state) => state.user);
  const unreadCount = useSelector(selectUnreadCount);

  // Desktop sidebar: expanded (256px labels) vs collapsed (72px icons)
  const [desktopExpanded, setDesktopExpanded] = useState(true);
  // Mobile drawer: open/closed
  const [mobileOpen, setMobileOpen] = useState(false);

  const [openMenus, setOpenMenus] = useState({});
  const [searchQuery, setSearchQuery] = useState("");
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    if (user) dispatch(fetchNotifications());
  }, [user, dispatch]);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsSearchOpen((p) => !p);
      }
      if (e.key === "Escape") {
        setIsSearchOpen(false);
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [mobileOpen]);

  const handleLogout = useCallback(() => {
    dispatch(logout());
    router.push("/");
  }, [dispatch, router]);

  const toggleMenu = useCallback((title) => {
    setOpenMenus((prev) => ({ ...prev, [title]: !prev[title] }));
  }, []);

  const driverAvatar = useMemo(
    () =>
      user?.avatar ||
      "https://api.dicebear.com/7.x/avataaars/svg?seed=DriverPartner&backgroundColor=b6e3f4",
    [user]
  );

  const searchSections = useMemo(
    () => [
      { label: "Frequently Visited", items: SOLO_DRIVER_PARTNER_SEARCH_LINKS[0] },
      { label: "Quick Actions", items: SOLO_DRIVER_PARTNER_SEARCH_LINKS[1] },
    ],
    []
  );

  const EXPANDED_W = 256;
  const COLLAPSED_W = 72;

  // ── Auth guard ──────────────────────────────────────────────────────────
  if (user?.role !== "solodriverpartner") {
    return (
      <div
        data-theme="transport"
        style={{ height: "100vh", width: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--base-100)", padding: "1.5rem" }}
      >
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          style={{ background: "color-mix(in srgb, var(--error), transparent 90%)", padding: "2.5rem", borderRadius: "1.5rem", border: "1px solid color-mix(in srgb, var(--error), transparent 80%)", maxWidth: 360, width: "100%", textAlign: "center" }}
        >
          <ShieldAlert size={44} style={{ color: "var(--error)", margin: "0 auto 1rem", display: "block" }} />
          <h1 style={{ fontSize: "0.875rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "var(--error)", marginBottom: "0.5rem" }}>
            Access Restricted
          </h1>
          <p style={{ fontSize: "0.75rem", color: "color-mix(in oklch, var(--base-content) 50%, transparent)" }}>
            This portal is exclusively for authorised Driver Partners.
          </p>
          <button onClick={() => router.push("/")} className="btn-secondary" style={{ marginTop: "1.5rem", cursor: "pointer", fontSize: "0.7rem" }}>
            Return to Home
          </button>
        </motion.div>
      </div>
    );
  }

  const currentPage =
    pathname.split("/").filter(Boolean).pop()?.replace(/-/g, " ") || "Dashboard";

  return (
    <div data-theme="transport" style={{ minHeight: "100vh", background: "var(--base-100)", color: "var(--base-content)" }}>
       
      {/* ─── All scoped CSS ─────────────────────────────────────────────────── */}
      <style>{`
        /* Nav item */
        .dp-nav-item {
          display: flex; align-items: center; gap: 0.625rem;
          padding: 0.4rem 0.75rem; font-size: 0.68rem; font-weight: 600;
          border-radius: 0.5rem; transition: all 0.15s; text-decoration: none;
          color: color-mix(in oklch, var(--base-content) 50%, transparent);
          background: transparent; letter-spacing: 0.02em; text-transform: uppercase;
        }
        .dp-nav-item:hover { color: var(--base-content); background: color-mix(in oklch, var(--base-300) 60%, transparent); }
        .dp-nav-item--active { color: var(--primary) !important; background: color-mix(in oklch, var(--primary) 10%, transparent) !important; }
        .dp-nav-label { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* Section button */
        .dp-section-btn {
          width: 100%; display: flex; align-items: center; justify-content: space-between;
          gap: 0.75rem; padding: 0.6rem 0.75rem; border-radius: 0.75rem; border: none;
          cursor: pointer; transition: all 0.15s; background: transparent;
          color: color-mix(in oklch, var(--base-content) 50%, transparent);
        }
        .dp-section-btn:hover { background: color-mix(in oklch, var(--base-300) 60%, transparent); color: var(--base-content); }
        .dp-section-btn--active { background: color-mix(in oklch, var(--primary) 10%, transparent) !important; color: var(--primary) !important; }
        .dp-section-inner { display: flex; align-items: center; gap: 0.75rem; min-width: 0; }
        .dp-section-icon { flex-shrink: 0; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; }
        .dp-section-title { font-size: 0.65rem; font-weight: 800; text-transform: uppercase; letter-spacing: 0.1em; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .dp-submenu { overflow: hidden; padding-left: 1rem; margin-top: 2px; border-left: 1px solid color-mix(in oklch, var(--base-300) 60%, transparent); margin-left: 1rem; }

        /* Sidebar structural */
        .dp-sidebar-hdr { height: 64px; display: flex; align-items: center; justify-content: space-between; padding: 0 1rem; border-bottom: 1px solid var(--base-300); flex-shrink: 0; gap: 0.5rem; }
        .dp-logo { display: flex; align-items: center; gap: 0.625rem; font-weight: 900; font-size: 0.875rem; letter-spacing: -0.02em; text-decoration: none; color: var(--base-content); font-family: var(--font-family-montserrat); transition: color 0.2s; white-space: nowrap; }
        .dp-logo:hover { color: var(--primary); }
        .dp-logo-icon { width: 32px; height: 32px; border-radius: 0.75rem; background: var(--primary); display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .dp-icon-btn { width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 0.5rem; border: none; background: transparent; color: color-mix(in oklch, var(--base-content) 40%, transparent); cursor: pointer; flex-shrink: 0; transition: all 0.15s; }
        .dp-icon-btn:hover { background: var(--base-300); color: var(--base-content); }
        .dp-sidebar-nav { flex: 1; overflow-y: auto; padding: 0.75rem 0.625rem; scrollbar-width: none; }
        .dp-sidebar-nav::-webkit-scrollbar { display: none; }
        .dp-user-strip { border-top: 1px solid var(--base-300); padding: 0.75rem; flex-shrink: 0; }
        .dp-user-inner { display: flex; align-items: center; gap: 0.75rem; padding: 0.5rem; border-radius: 0.75rem; cursor: pointer; transition: background 0.15s; }
        .dp-user-inner:hover { background: color-mix(in oklch, var(--base-300) 60%, transparent); }
        .dp-avatar { width: 32px; height: 32px; border-radius: 0.5rem; object-fit: cover; background: var(--base-300); flex-shrink: 0; }
        .dp-user-name { font-size: 0.7rem; font-weight: 700; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; color: var(--base-content); margin: 0; }
        .dp-user-role { font-size: 0.6rem; color: var(--primary); font-weight: 800; text-transform: uppercase; letter-spacing: 0.15em; margin: 0; }

        /* Theme & header btns */
        .dp-theme-btn { width: 36px; height: 36px; border-radius: 0.75rem; border: 1px solid var(--base-300); display: flex; align-items: center; justify-content: center; color: color-mix(in oklch, var(--base-content) 50%, transparent); background: transparent; cursor: pointer; flex-shrink: 0; transition: all 0.2s; }
        .dp-theme-btn:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); border-color: color-mix(in oklch, var(--primary) 40%, transparent); }
        .dp-hdr-btn { width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; border-radius: 0.75rem; border: 1px solid var(--base-300); background: transparent; color: color-mix(in oklch, var(--base-content) 50%, transparent); cursor: pointer; transition: all 0.2s; flex-shrink: 0; }
        .dp-hdr-btn:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); border-color: color-mix(in oklch, var(--primary) 40%, transparent); }

        /* Dropdown */
        .dp-dd-group { position: relative; }
        .dp-dd { position: absolute; left: 0; top: 100%; padding-top: 0.75rem; z-index: 50; opacity: 0; visibility: hidden; transition: all 0.2s; }
        .dp-dd-group:hover .dp-dd { opacity: 1; visibility: visible; }
        .dp-dd-inner { width: 200px; background: var(--base-200); border: 1px solid var(--base-300); border-radius: 1rem; box-shadow: var(--shadow-depth); padding: 0.375rem; }
        .dp-dd-link { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.75rem; font-size: 0.65rem; font-weight: 700; text-transform: uppercase; color: color-mix(in oklch, var(--base-content) 50%, transparent); text-decoration: none; border-radius: 0.625rem; transition: all 0.15s; }
        .dp-dd-link:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); color: var(--primary); }

        /* Profile dropdown */
        .dp-profile-link { display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.75rem; font-size: 0.7rem; font-weight: 600; color: color-mix(in oklch, var(--base-content) 60%, transparent); text-decoration: none; border-radius: 0.75rem; transition: all 0.15s; }
        .dp-profile-link:hover { background: var(--base-100); color: var(--primary); }
        .dp-logout-btn { width: 100%; display: flex; align-items: center; gap: 0.625rem; padding: 0.625rem 0.75rem; font-size: 0.7rem; font-weight: 800; color: var(--error); background: transparent; border: none; border-radius: 0.75rem; cursor: pointer; text-transform: uppercase; letter-spacing: 0.08em; transition: background 0.15s; }
        .dp-logout-btn:hover { background: color-mix(in srgb, var(--error), transparent 90%); }

        /* Mobile bottom nav */
        .dp-mob-nav-item { display: flex; flex-direction: column; align-items: center; gap: 0.25rem; padding: 0.5rem 1rem; border-radius: 0.75rem; border: none; background: transparent; color: color-mix(in oklch, var(--base-content) 40%, transparent); cursor: pointer; text-decoration: none; transition: all 0.15s; font-family: var(--font-family-poppins); }
        .dp-mob-nav-item:hover { color: var(--base-content); }
        .dp-mob-nav-item--active { background: color-mix(in oklch, var(--primary) 10%, transparent) !important; color: var(--primary) !important; }
        .dp-mob-nav-label { font-size: 0.55rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; }

        /* Search */
        .dp-search-item { display: flex; align-items: center; justify-content: space-between; padding: 0.625rem 0.75rem; border-radius: 0.75rem; text-decoration: none; transition: background 0.15s; }
        .dp-search-item:hover { background: color-mix(in oklch, var(--primary) 10%, transparent); }
        .dp-search-item:hover .dp-si { color: var(--primary); }
        .dp-search-item:hover .dp-sl { color: var(--base-content); }
        .dp-search-item:hover .dp-sa { opacity: 1; }
        .dp-si { color: color-mix(in oklch, var(--base-content) 30%, transparent); transition: color 0.15s; }
        .dp-sl { font-size: 0.7rem; font-weight: 700; color: color-mix(in oklch, var(--base-content) 60%, transparent); text-transform: uppercase; letter-spacing: 0.04em; transition: color 0.15s; }
        .dp-sa { opacity: 0; color: var(--primary); transition: opacity 0.15s; }

        /* ── RESPONSIVE: key breakpoint is 1024px (lg) ── */

        /* Desktop (≥1024px): desktop sidebar visible, mobile drawer + bottom nav hidden */
        @media (min-width: 1024px) {
          .dp-desktop-sidebar { display: flex !important; }
          .dp-mobile-hamburger { display: none !important; }
          .dp-mobile-bottom-nav { display: none !important; }
          .dp-desktop-toplinks { display: flex !important; }
          .dp-main { margin-left: ${EXPANDED_W}px; }
          .dp-main--collapsed { margin-left: ${COLLAPSED_W}px !important; }
        }

        /* Mobile / tablet (<1024px): hide desktop sidebar, show hamburger + bottom nav */
        @media (max-width: 1023px) {
          .dp-desktop-sidebar { display: none !important; }
          .dp-mobile-hamburger { display: flex !important; }
          .dp-mobile-bottom-nav { display: flex !important; }
          .dp-desktop-toplinks { display: none !important; }
          .dp-main { margin-left: 0 !important; padding-bottom: 72px; }
        }

        /* Pulse dot */
        @keyframes dp-pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
      `}</style>

      {/* ════════════════════════════════════════════
          DESKTOP SIDEBAR
          Only rendered/visible at ≥1024px via CSS
      ════════════════════════════════════════════ */}
      <aside
        className="dp-desktop-sidebar"
        style={{
          position: "fixed",
          left: 0,
          top: 0,
          zIndex: 50,
          height: "100vh",
          flexDirection: "column",
          background: "var(--base-200)",
          borderRight: "1px solid var(--base-300)",
          transition: "width 0.3s cubic-bezier(0.4,0,0.2,1)",
          width: desktopExpanded ? EXPANDED_W : COLLAPSED_W,
          overflow: "hidden",
        }}
      >
        <SidebarBody
          expanded={desktopExpanded}
          openMenus={openMenus}
          toggleMenu={toggleMenu}
          pathname={pathname}
          user={user}
          driverAvatar={driverAvatar}
          onDesktopToggle={() => setDesktopExpanded((p) => !p)}
        />
      </aside>

      {/* ════════════════════════════════════════════
          MOBILE DRAWER + BACKDROP
          Slide-in overlay, only usable on <1024px
          (AnimatePresence fully removes from DOM when closed)
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="dp-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22 }}
              onClick={() => setMobileOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.65)",
                backdropFilter: "blur(6px)",
                zIndex: 55,
              }}
            />

            {/* Drawer panel — full sidebar with labels */}
            <motion.aside
              key="dp-drawer"
              initial={{ x: -EXPANDED_W }}
              animate={{ x: 0 }}
              exit={{ x: -EXPANDED_W }}
              transition={{ type: "spring", damping: 28, stiffness: 260 }}
              style={{
                position: "fixed",
                left: 0,
                top: 0,
                zIndex: 60,
                height: "100vh",
                width: EXPANDED_W,
                display: "flex",
                flexDirection: "column",
                background: "var(--base-200)",
                borderRight: "1px solid var(--base-300)",
                boxShadow: "6px 0 32px rgba(0,0,0,0.22)",
              }}
            >
              <SidebarBody
                expanded={true}          
                openMenus={openMenus}
                toggleMenu={toggleMenu}
                pathname={pathname}
                user={user}
                driverAvatar={driverAvatar}
                onClose={() => setMobileOpen(false)}
              />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════
          MAIN CONTENT AREA
      ════════════════════════════════════════════ */}
      <div
        className={`dp-main${!desktopExpanded ? " dp-main--collapsed" : ""}`}
        style={{
          display: "flex",
          flexDirection: "column",
          minHeight: "100vh",
          transition: "margin-left 0.3s cubic-bezier(0.4,0,0.2,1)",
        }}
      >
        {/* ── Header ── */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 40,
            height: 64,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid var(--base-300)",
            background: "color-mix(in oklch, var(--base-100) 80%, transparent)",
            backdropFilter: "blur(20px) saturate(180%)",
            padding: "0 1.25rem",
            gap: "0.75rem",
            flexShrink: 0,
          }}
        >
          {/* Left group */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0 }}>
            {/* Hamburger — mobile only */}
            <button
              className="dp-mobile-hamburger dp-hdr-btn"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation menu"
            >
              <Menu size={17} />
            </button>

            {/* Search trigger */}
            <button
              onClick={() => setIsSearchOpen(true)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.625rem",
                padding: "0.5rem 0.875rem",
                background: "var(--base-200)",
                border: "1px solid var(--base-300)",
                borderRadius: "0.75rem",
                color: "color-mix(in oklch, var(--base-content) 40%, transparent)",
                cursor: "pointer",
                transition: "all 0.2s",
                whiteSpace: "nowrap",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "color-mix(in srgb, var(--primary), transparent 50%)";
                e.currentTarget.style.color = "var(--base-content)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--base-300)";
                e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 40%, transparent)";
              }}
            >
              <Search size={13} style={{ flexShrink: 0 }} />
              <span style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Search
              </span>
              <kbd style={{ fontSize: "0.6rem", fontFamily: "monospace", background: "var(--base-300)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", color: "color-mix(in oklch, var(--base-content) 30%, transparent)" }}>
                ⌘K
              </kbd>
            </button>

            {/* Desktop quick nav links */}
            <div className="dp-desktop-toplinks" style={{ alignItems: "center", gap: "0.25rem", marginLeft: "0.5rem" }}>
              {SOLO_DRIVER_PARTNER_TOP_RIGHT_LINKS.map((item, i) => (
                <div key={i} className="dp-dd-group">
                  <button
                    style={{
                      display: "flex", alignItems: "center", gap: "0.375rem",
                      padding: "0.375rem 0.75rem", fontSize: "0.65rem", fontWeight: 700,
                      textTransform: "uppercase", letterSpacing: "0.08em",
                      color: "color-mix(in oklch, var(--base-content) 40%, transparent)",
                      background: "transparent", border: "none", borderRadius: "0.5rem",
                      cursor: "pointer", transition: "all 0.15s", whiteSpace: "nowrap",
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.color = "var(--primary)"; e.currentTarget.style.background = "color-mix(in oklch, var(--primary) 5%, transparent)"; }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 40%, transparent)"; e.currentTarget.style.background = "transparent"; }}
                  >
                    {item.icon}{item.name}
                  </button>
                  {item.links && (
                    <div className="dp-dd">
                      <div className="dp-dd-inner">
                        {item.links.map((sub, si) => (
                          <Link key={si} href={sub.href} className="dp-dd-link">
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

          {/* Right group */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}>
            <ThemeToggle />

            {/* Notifications */}
            <Link href="/partner/solo/notifications" style={{ textDecoration: "none" }}>
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className="dp-hdr-btn"
                style={{ position: "relative" }}
              >
                <motion.div
                  animate={unreadCount > 0 ? { rotate: [0, 14, -14, 8, -8, 0] } : {}}
                  transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 3 }}
                >
                  <Bell size={15} />
                </motion.div>
                {unreadCount > 0 && (
                  <span
                    style={{
                      position: "absolute", top: 6, right: 6, width: 7, height: 7,
                      background: "var(--primary)", borderRadius: "9999px",
                      border: "2px solid var(--base-100)",
                      animation: "dp-pulse 2s infinite",
                    }}
                  />
                )}
              </motion.button>
            </Link>

            {/* Profile avatar + dropdown */}
            <div style={{ position: "relative" }}>
              <button
                onClick={() => setProfileOpen((p) => !p)}
                style={{
                  width: 36, height: 36, borderRadius: "0.75rem",
                  background: "linear-gradient(135deg, var(--primary), var(--secondary))",
                  padding: 2, cursor: "pointer", border: "none", transition: "transform 0.2s",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.05)")}
                onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
              >
                <img
                  src={driverAvatar}
                  alt="Profile"
                  style={{ width: "100%", height: "100%", borderRadius: "0.625rem", objectFit: "cover", display: "block" }}
                />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.15 }}
                    style={{
                      position: "absolute", right: 0, top: "100%", marginTop: "0.5rem",
                      width: 240, background: "var(--base-200)", border: "1px solid var(--base-300)",
                      borderRadius: "1.25rem", boxShadow: "var(--shadow-depth)",
                      overflow: "hidden", zIndex: 50,
                    }}
                  >
                    <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid var(--base-300)", background: "color-mix(in oklch, var(--primary) 5%, transparent)" }}>
                      <p style={{ fontSize: "0.7rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--base-content)", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {user?.name || "Driver Partner"}
                      </p>
                      <p style={{ fontSize: "0.6rem", color: "var(--primary)", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.2em", margin: "2px 0 0" }}>
                        Solo Driver Partner
                      </p>
                    </div>
                    <div style={{ padding: "0.375rem" }}>
                      {SOLO_DRIVER_PARTNER_PROFILE_LINKS.map((pl, pi) => (
                        <Link key={pi} href={pl.href} onClick={() => setProfileOpen(false)} className="dp-profile-link">
                          {pl.icon}{pl.name}
                        </Link>
                      ))}
                    </div>
                    <div style={{ padding: "0.375rem", borderTop: "1px solid var(--base-300)" }}>
                      <button onClick={handleLogout} className="dp-logout-btn">
                        <LogOut size={13} />Sign Out
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* ── Page content ── */}
        <main style={{ flex: 1, display: "flex", flexDirection: "column" }}>
          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "1rem 1.25rem 0.25rem" }}>
            <Link
              href="/partner/solo/dashboard"
              style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.15em", color: "color-mix(in oklch, var(--base-content) 25%, transparent)", textDecoration: "none", transition: "color 0.2s" }}
              onMouseEnter={(e) => (e.currentTarget.style.color = "var(--primary)")}
              onMouseLeave={(e) => (e.currentTarget.style.color = "color-mix(in oklch, var(--base-content) 25%, transparent)")}
            >
              Home
            </Link>
            <ChevronRight size={10} style={{ color: "color-mix(in oklch, var(--base-content) 20%, transparent)" }} />
            <span style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "capitalize", letterSpacing: "0.15em", color: "var(--primary)" }}>
              {currentPage}
            </span>
          </div>

          {/* Content card */}
          <div style={{ flex: 1, padding: "0.75rem 1rem 1.5rem" }}>
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2 }}
              style={{
                position: "relative", borderRadius: "1rem",
                border: "1px solid var(--base-300)",
                background: "color-mix(in oklch, var(--base-200) 50%, transparent)",
                minHeight: "75vh", padding: "1.5rem", overflow: "hidden", backdropFilter: "blur(8px)",
              }}
            >
              <div style={{ position: "absolute", top: 0, right: 0, width: 384, height: 384, pointerEvents: "none", borderRadius: "9999px", opacity: 0.4, background: "radial-gradient(circle at top right, oklch(65% 0.12 190 / 0.12), transparent 70%)" }} />
              <div style={{ position: "relative", zIndex: 10 }}>{children}</div>
            </motion.div>
          </div>
        </main>

        {/* ── Footer — desktop only ── */}
        <footer className="dp-desktop-toplinks" style={{ padding: "0 1.25rem 1.25rem", flexDirection: "column" }}>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: "1rem", padding: "1rem 1.25rem", border: "1px solid var(--base-300)", borderRadius: "1rem", background: "color-mix(in oklch, var(--base-200) 60%, transparent)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <div style={{ width: 36, height: 36, borderRadius: "0.75rem", background: "color-mix(in oklch, var(--primary) 10%, transparent)", display: "flex", alignItems: "center", justifyContent: "center", color: "var(--primary)", flexShrink: 0 }}>
                <Car size={15} />
              </div>
              <div>
                <p style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "color-mix(in oklch, var(--base-content) 50%, transparent)", margin: 0 }}>Driver Partner Portal</p>
                <p style={{ fontSize: "0.55rem", fontWeight: 700, color: "color-mix(in oklch, var(--base-content) 25%, transparent)", textTransform: "uppercase", letterSpacing: "0.15em", margin: 0 }}>Likeson.in</p>
              </div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.5rem" }}>
              {SOLO_DRIVER_PARTNER_SHORTCUTS.map((sc, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.375rem 0.75rem", background: "color-mix(in oklch, var(--base-100) 60%, transparent)", border: "1px solid var(--base-300)", borderRadius: "0.625rem" }}>
                  <span style={{ fontSize: "0.6rem", fontWeight: 900, color: "color-mix(in oklch, var(--base-content) 35%, transparent)", textTransform: "uppercase", letterSpacing: "0.1em" }}>{sc.name}</span>
                  <kbd style={{ fontSize: "0.6rem", fontFamily: "monospace", background: "var(--base-300)", padding: "0.125rem 0.375rem", borderRadius: "0.25rem", color: "color-mix(in oklch, var(--base-content) 40%, transparent)" }}>{sc.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </footer>

        {/* ── Mobile bottom nav ── */}
        <nav
          className="dp-mobile-bottom-nav"
          style={{
            position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 40,
            background: "color-mix(in oklch, var(--base-200) 92%, transparent)",
            backdropFilter: "blur(20px) saturate(180%)",
            borderTop: "1px solid var(--base-300)",
            alignItems: "center",
            justifyContent: "space-around",
            padding: "0.375rem 0.5rem env(safe-area-inset-bottom, 0.375rem)",
          }}
        >
          {[
            {
              icon: (
                <svg style={{ width: 20, height: 20 }} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1" />
                  <rect x="14" y="3" width="7" height="7" rx="1" />
                  <rect x="3" y="14" width="7" height="7" rx="1" />
                  <rect x="14" y="14" width="7" height="7" rx="1" />
                </svg>
              ),
              label: "Home",
              href: "/partner/solo/dashboard",
            },
            { icon: <Search size={20} />, label: "Search", action: () => setIsSearchOpen(true) },
            {
              icon: (
                <div style={{ position: "relative" }}>
                  <Bell size={20} />
                  {unreadCount > 0 && (
                    <span style={{ position: "absolute", top: -3, right: -3, width: 7, height: 7, background: "var(--primary)", borderRadius: "9999px", border: "1px solid var(--base-200)" }} />
                  )}
                </div>
              ),
              label: "Alerts",
              href: "/partner/solo/notifications",
            },
            { icon: <UserRound size={20} />, label: "Profile", href: "/partner/solo/profile" },
          ].map((item, i) => {
            const isActive = item.href ? pathname === item.href : false;
            const Comp = item.href ? Link : "button";
            return (
              <Comp
                key={i}
                href={item.href || undefined}
                onClick={item.action}
                className={`dp-mob-nav-item${isActive ? " dp-mob-nav-item--active" : ""}`}
              >
                {item.icon}
                <span className="dp-mob-nav-label">{item.label}</span>
              </Comp>
            );
          })}
        </nav>
      </div>

      {/* ════════════════════════════════════════════
          SEARCH OVERLAY
      ════════════════════════════════════════════ */}
      <AnimatePresence>
        {isSearchOpen && (
          <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", alignItems: "flex-start", justifyContent: "center", padding: "12vh 1rem 1rem" }}>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSearchOpen(false)}
              style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.72)", backdropFilter: "blur(10px)" }}
            />
            <motion.div
              initial={{ opacity: 0, y: -16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -16, scale: 0.97 }}
              transition={{ duration: 0.18 }}
              style={{ position: "relative", width: "100%", maxWidth: 520, background: "var(--base-200)", border: "1px solid var(--base-300)", borderRadius: "1.5rem", boxShadow: "var(--shadow-depth)", overflow: "hidden" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "1rem 1.25rem", borderBottom: "1px solid var(--base-300)", background: "color-mix(in oklch, var(--base-100) 40%, transparent)" }}>
                <Search size={17} style={{ color: "var(--primary)", flexShrink: 0 }} />
                <input
                  autoFocus
                  placeholder="Search pages and actions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: "0.8rem", fontWeight: 600, color: "var(--base-content)", fontFamily: "var(--font-family-poppins)" }}
                />
                <button
                  onClick={() => setIsSearchOpen(false)}
                  style={{ fontSize: "0.6rem", fontWeight: 900, background: "var(--base-300)", padding: "0.25rem 0.625rem", borderRadius: "0.375rem", color: "color-mix(in oklch, var(--base-content) 40%, transparent)", border: "none", cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em", flexShrink: 0 }}
                >
                  Esc
                </button>
              </div>

              <div style={{ maxHeight: "52vh", overflowY: "auto", padding: "0.75rem", display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                {searchSections.map(({ label, items }) => {
                  const filtered = items?.filter((item) =>
                    item.name.toLowerCase().includes(searchQuery.toLowerCase())
                  );
                  if (!filtered?.length) return null;
                  return (
                    <div key={label}>
                      <p style={{ fontSize: "0.6rem", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.2em", color: "var(--primary)", margin: "0 0 0.5rem 0.5rem" }}>
                        {label}
                      </p>
                      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        {filtered.map((item, j) => (
                          <Link
                            key={j}
                            href={item.href}
                            onClick={() => { setIsSearchOpen(false); setSearchQuery(""); }}
                            className="dp-search-item"
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                              <span className="dp-si">{item.icon}</span>
                              <span className="dp-sl">{item.name}</span>
                            </div>
                            <ExternalLink size={11} className="dp-sa" />
                          </Link>
                        ))}
                      </div>
                    </div>
                  );
                })}

                {searchSections.every(
                  ({ items }) => !items?.filter((i) => i.name.toLowerCase().includes(searchQuery.toLowerCase())).length
                ) && (
                  <p style={{ fontSize: "0.7rem", color: "color-mix(in oklch, var(--base-content) 30%, transparent)", textAlign: "center", padding: "2rem 0" }}>
                    No results for &quot;{searchQuery}&quot;
                  </p>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default memo(SoloDriverPartnerDashboard);