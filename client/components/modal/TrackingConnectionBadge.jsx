'use client';
import { motion, AnimatePresence } from 'framer-motion';
import { Wifi, WifiOff, Loader2, AlertTriangle } from 'lucide-react';

const CONFIGS = {
  connected:    { label: 'Live',         icon: Wifi,          cls: 'bg-success/10 text-success border-success/30',    pulse: true  },
  connecting:   { label: 'Connecting…',  icon: Loader2,       cls: 'bg-warning/10 text-warning border-warning/30',    pulse: false },
  disconnected: { label: 'Offline',      icon: WifiOff,       cls: 'bg-error/10 text-error border-error/30',          pulse: false },
  error:        { label: 'Error',        icon: AlertTriangle, cls: 'bg-error/10 text-error border-error/30',          pulse: false },
};

export default function TrackingConnectionBadge({ status = 'connecting', compact = false }) {
  const cfg  = CONFIGS[status] ?? CONFIGS.disconnected;
  const Icon = cfg.icon;

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={status}
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.9 }}
        transition={{ duration: 0.2 }}
        className={`relative inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-xs font-semibold font-poppins ${cfg.cls}`}
      >
        {cfg.pulse && (
          <span className="absolute -top-0.5 -right-0.5 w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
        )}
        <Icon
          size={11}
          className={status === 'connecting' ? 'animate-spin' : ''}
        />
        {!compact && <span className="tracking-wide">{cfg.label}</span>}
      </motion.div>
    </AnimatePresence>
  );
}