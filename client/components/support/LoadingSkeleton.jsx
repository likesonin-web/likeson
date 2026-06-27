'use client';

import { motion } from 'framer-motion';

function SkeletonBox({ className = '' }) {
  return <div className={`skeleton rounded-field ${className}`} />;
}

export function TicketCardSkeleton() {
  return (
    <div className="card p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <SkeletonBox className="h-3 w-20" />
        <SkeletonBox className="h-5 w-16 rounded-selector" />
      </div>
      <SkeletonBox className="h-4 w-3/4" />
      <SkeletonBox className="h-3 w-full" />
      <div className="flex items-center gap-2">
        <SkeletonBox className="h-6 w-6 rounded-full shrink-0" />
        <SkeletonBox className="h-3 w-20" />
      </div>
    </div>
  );
}

export function TicketListSkeleton({ count = 6 }) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {Array.from({ length: count }).map((_, i) => (
        <TicketCardSkeleton key={i} />
      ))}
    </div>
  );
}

export function MessageBubbleSkeleton({ align = 'left' }) {
  return (
    <div className={`flex px-4 py-1.5 ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <SkeletonBox className="h-12 w-2/5 rounded-2xl" />
    </div>
  );
}

export function ChatSkeleton() {
  return (
    <div className="flex flex-col gap-1 py-4">
      <MessageBubbleSkeleton align="left" />
      <MessageBubbleSkeleton align="right" />
      <MessageBubbleSkeleton align="left" />
      <MessageBubbleSkeleton align="left" />
      <MessageBubbleSkeleton align="right" />
    </div>
  );
}

export default function LoadingSkeleton({ variant = 'ticketList', ...props }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
      {variant === 'ticketList' && <TicketListSkeleton {...props} />}
      {variant === 'ticketCard' && <TicketCardSkeleton {...props} />}
      {variant === 'chat' && <ChatSkeleton {...props} />}
    </motion.div>
  );
}
