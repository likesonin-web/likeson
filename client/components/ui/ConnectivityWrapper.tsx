"use client";

import { useOnlineStatus } from "@/hooks/use-online-status";
import NoInternetPage from "../../app/offline";
import { AnimatePresence, motion } from "framer-motion";

export default function ConnectivityWrapper({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus();

  return (
    <AnimatePresence mode="wait">
      {!isOnline ? (
        <motion.div
          key="offline"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[9999] bg-background"
        >
          
          <NoInternetPage />
        </motion.div>
      ) : (
        <motion.div key="online" className="h-full">
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}