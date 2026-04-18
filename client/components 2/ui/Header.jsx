'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, User, Calendar, Menu, X, 
  ChevronRight, LogOut, LayoutDashboard, Bell,
  ShieldCheck, Settings, Sun, Moon
} from 'lucide-react';
import { useSelector, useDispatch } from 'react-redux';
import { useTheme } from 'next-themes';

import Container from './Container';
import { NAV_LINKS } from '@/constants/data';
import { cn } from '@/lib/utils';
import RoleNavLinks from '../RoleNavLinks';
import { logoutAction } from '@/store/slices/userSlice';

const Header = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  
  const pathname = usePathname();
  const router = useRouter();
  const dispatch = useDispatch();
  const { theme, setTheme } = useTheme();
  const { user } = useSelector((state) => state.user);

  useEffect(() => { setMounted(true); }, []);

  // Sync Body Scroll with Mobile Menu
  useEffect(() => {
    document.body.style.overflow = isMobileMenuOpen ? 'hidden' : 'unset';
  }, [isMobileMenuOpen]);

  const handleLogout = () => {
    dispatch(logoutAction()); 
    setIsMobileMenuOpen(false);
    setIsUserMenuOpen(false);
    router.push('/login');
  };

  if (!mounted) return <div className="h-20 bg-base-100" />;

  const userAvatar = user?.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.name || 'User')}&background=2563eb&color=fff`;

  return (
    <header className="sticky top-0 z-50 w-full bg-base-100 border-b border-base-300">
      {/* --- UPPER BAR --- */}
      <div className="py-3">
        <Container className="flex items-center justify-between gap-6">
          
          {/* LOGO */}
          <Link href="/" className="flex-shrink-0 active:scale-95 transition-transform">
            <h1 className="text-2xl font-black text-primary tracking-tighter uppercase">
              Likeson<span className="text-accent">.in</span>
            </h1>
          </Link>

          {/* SURGICAL SEARCH */}
          <div className="hidden lg:flex flex-1 max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-base-content/40" />
            <input 
              type="text"
              placeholder="Search medical services..." 
              className="input-field w-full pl-11 bg-base-200 border-base-300 focus:bg-base-100" 
            />
          </div>

          {/* ACTIONS */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle */}
            <button 
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="p-2.5 rounded-selector border border-base-300 hover:bg-base-200 text-base-content/70 transition-colors"
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            {user ? (
              <div className="flex items-center gap-3 relative">
                {/* Notifications */}
                <button className="hidden sm:flex p-2.5 rounded-selector bg-base-200 text-base-content/60 relative hover:text-primary transition-colors">
                  <Bell size={18} />
                  <span className="absolute top-2 right-2 w-2 h-2 bg-error rounded-full border-2 border-base-100"></span>
                </button>

                {/* USER AVATAR & DROPDOWN */}
                <div className="relative">
                  <button 
                    onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                    className="h-10 w-10 rounded-selector border-2 border-primary overflow-hidden hover:scale-105 transition-transform"
                  >
                    <img src={userAvatar} alt="user" className="w-full h-full object-cover" />
                  </button>

                  {/* CUSTOM DROPDOWN (Manual implementation to replace Shadcn) */}
                  <AnimatePresence>
                    {isUserMenuOpen && (
                      <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsUserMenuOpen(false)} />
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 10 }}
                          className="absolute right-0 mt-3 w-64 bg-base-100 border border-base-300 shadow-depth rounded-box z-20 p-2"
                        >
                          <div className="p-3 mb-2 bg-base-200 rounded-field">
                            <p className="text-xs font-black uppercase text-primary mb-1">{user.role}</p>
                            <p className="text-sm font-bold text-base-content truncate">{user.name}</p>
                            <p className="text-[10px] text-base-content/50 truncate">{user.email}</p>
                          </div>
                          
                          <div className="space-y-1">
                             <RoleNavLinks user={user} currentPathname={pathname} onLinkClick={() => setIsUserMenuOpen(false)} />
                             <button 
                               onClick={handleLogout}
                               className="w-full flex items-center gap-3 p-3 text-xs font-black text-error hover:bg-error/10 rounded-field transition-colors uppercase tracking-widest"
                             >
                               <LogOut size={16} /> Sign Out
                             </button>
                          </div>
                        </motion.div>
                      </>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ) : (
              <Link href="/login" className="hidden sm:block text-xs font-black uppercase tracking-widest text-base-content/60 hover:text-primary px-4">
                Login
              </Link>
            )}

            <Link href="/book-appointment">
              <button className="btn-primary-cta py-2.5 px-6 text-[11px] font-black uppercase tracking-widest flex items-center gap-2">
                <Calendar size={16} />
                <span className="hidden sm:inline">Book Now</span>
              </button>
            </Link>

            {/* Mobile Toggle */}
            <button 
              className="lg:hidden p-2 rounded-selector bg-neutral text-neutral-content"
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            >
              {isMobileMenuOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </Container>
      </div>

      {/* --- MAIN NAV --- */}
      <nav className="hidden lg:block border-t border-base-300 bg-base-200">
        <Container className="flex items-center justify-center">
          {NAV_LINKS.map((link) => (
            <Link 
              key={link.name} 
              href={link.href}
              className={cn(
                "px-8 py-4 text-[10px] font-black uppercase tracking-[0.2em] transition-all relative border-r last:border-r-0 border-base-300",
                pathname === link.href ? "bg-base-100 text-primary" : "text-base-content/50 hover:bg-base-100 hover:text-primary"
              )}
            >
              {link.name}
              {pathname === link.href && (
                <div className="absolute bottom-0 left-0 w-full h-1 bg-primary" />
              )}
            </Link>
          ))}
        </Container>
      </nav>

      {/* --- MOBILE MENU --- */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }}
            className="fixed inset-0 top-[65px] bg-base-100 z-50 p-6 flex flex-col gap-6"
          >
            <div className="space-y-2">
              <p className="text-[10px] font-black text-base-content/30 uppercase tracking-[0.3em] mb-4">Navigation</p>
              {NAV_LINKS.map((link) => (
                <Link 
                  key={link.name} 
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center justify-between p-4 bg-base-200 rounded-field border border-base-300"
                >
                  <span className="font-black uppercase text-sm">{link.name}</span>
                  <ChevronRight size={18} className="text-primary" />
                </Link>
              ))}
            </div>

            {user ? (
               <button 
                onClick={handleLogout}
                className="mt-auto w-full p-5 bg-error text-white font-black uppercase tracking-widest rounded-field"
               >
                 Logout
               </button>
            ) : (
              <Link href="/login" className="mt-auto" onClick={() => setIsMobileMenuOpen(false)}>
                <button className="btn-primary-cta w-full p-5 font-black uppercase tracking-widest">
                  Account Login
                </button>
              </Link>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
};

export default Header;