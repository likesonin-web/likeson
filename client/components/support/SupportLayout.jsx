'use client';

/**
 * BUG FIX: All inline styles replaced with Tailwind CSS classes.
 * Responsive: flex-col on mobile, sidebar collapses on desktop.
 */
import { AnimatePresence, motion } from 'framer-motion';
import { usePathname } from 'next/navigation';

import SupportSidebar from './SupportSidebar';
import SupportHeader from './SupportHeader';

export default function SupportLayout({ children, onSearch, searchValue }) {
  const pathname = usePathname();

  return (
    <div className="flex h-dvh w-full overflow-hidden bg-base-200">
      <SupportSidebar />

      <div className="flex flex-1 flex-col min-w-0 overflow-hidden">
        <SupportHeader onSearch={onSearch} searchValue={searchValue} />

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="h-full"
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
