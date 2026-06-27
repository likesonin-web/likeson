'use client';

import { MessageSquare } from 'lucide-react';

export default function EmptyState({ icon: Icon = MessageSquare, title, subtitle, action }) {
  return (
    <div className="flex flex-col items-center justify-center h-full px-6 text-center gap-3">
      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
        <Icon className="w-7 h-7 text-primary" />
      </div>
      <h3 className="text-base font-bold text-base-content">{title}</h3>
      {subtitle && <p className="text-sm text-base-content/60 max-w-xs">{subtitle}</p>}
      {action}
    </div>
  );
}
