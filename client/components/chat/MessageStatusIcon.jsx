'use client';

import { Check, CheckCheck, Clock } from 'lucide-react';

/** Renders the WhatsApp-style sent / delivered / read tick for own messages. */
export default function MessageStatusIcon({ message }) {
  if (message.readAt) return <CheckCheck className="w-3.5 h-3.5 text-info" />;
  if (message.deliveredAt) return <CheckCheck className="w-3.5 h-3.5 text-base-content/40" />;
  if (message._id) return <Check className="w-3.5 h-3.5 text-base-content/40" />;
  return <Clock className="w-3 h-3 text-base-content/40" />;
}
