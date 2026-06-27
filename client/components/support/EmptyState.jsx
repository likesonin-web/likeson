'use client';

import { motion } from 'framer-motion';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: 'easeOut' }}
      className="flex flex-col items-center justify-center text-center px-6 py-20 gap-4 w-full h-full"
    >
      <div className="rounded-box bg-primary/10 border border-primary/20 p-5 flex items-center justify-center">
        <Icon className="w-8 h-8 text-primary" strokeWidth={1.5} />
      </div>
      <div className="space-y-1">
        <h5 className="font-montserrat font-bold text-base-content">{title}</h5>
        {description && (
          <p className="text-sm text-base-content/55 max-w-[26rem] mx-auto leading-relaxed">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </motion.div>
  );
}
