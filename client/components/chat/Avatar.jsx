'use client';

import { useState } from 'react';

const SIZES = {
  xs: 'w-7 h-7 text-[10px]',
  sm: 'w-9 h-9 text-xs',
  md: 'w-11 h-11 text-sm',
  lg: 'w-14 h-14 text-base',
  xl: 'w-20 h-20 text-xl',
};

// Sample avatar pool keyed by role — uses DiceBear Avataaars (no signup, free, stable URLs)
const ROLE_AVATARS = {
  doctor:           'https://api.dicebear.com/8.x/avataaars/svg?seed=doctor&backgroundColor=b6e3f4',
  driver:           'https://api.dicebear.com/8.x/avataaars/svg?seed=driver&backgroundColor=d1d4f9',
  pharmacy:         'https://api.dicebear.com/8.x/avataaars/svg?seed=pharmacy&backgroundColor=c0aede',
  'care assistant': 'https://api.dicebear.com/8.x/avataaars/svg?seed=careassistant&backgroundColor=ffd5dc',
  transportpartner: 'https://api.dicebear.com/8.x/avataaars/svg?seed=transport&backgroundColor=ffdfbf',
  admin:            'https://api.dicebear.com/8.x/avataaars/svg?seed=admin&backgroundColor=f4d03f',
  superadmin:       'https://api.dicebear.com/8.x/avataaars/svg?seed=superadmin&backgroundColor=e8daef',
  customer:         'https://api.dicebear.com/8.x/avataaars/svg?seed=customer&backgroundColor=d5f5e3',
};

// Deterministic per-user fallback — seeds DiceBear with the user's name so each
// person consistently gets the same generated face across sessions.
const getSampleAvatar = (name = '', role = '') =>
  ROLE_AVATARS[role?.toLowerCase()] ??
  `https://api.dicebear.com/8.x/avataaars/svg?seed=${encodeURIComponent(name || 'user')}&backgroundColor=eeeeee`;

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('') || '?';

export default function Avatar({ src, name, role, size = 'md', online, className = '' }) {
  const [broken, setBroken] = useState(false);

  // Priority: explicit src → sample avatar (by name/role) → initials fallback
  const effectiveSrc = (!broken && src) ? src
    : (!broken)                           ? getSampleAvatar(name, role)
    : null;

  return (
    <div className={`relative inline-flex shrink-0 ${className}`}>
      <div
        className={`avatar placeholder ${SIZES[size]} rounded-full overflow-hidden flex items-center justify-center font-bold bg-base-200`}
      >
        {effectiveSrc ? (
          <img
            src={effectiveSrc}
            alt={name || 'avatar'}
            className="w-full h-full object-cover"
            onError={() => setBroken(true)}
          />
        ) : (
          <span>{initials(name)}</span>
        )}
      </div>

      {typeof online === 'boolean' && (
        <span
          className={`absolute -bottom-0.5 -right-0.5 block rounded-full ring-2 ring-base-100 ${
            size === 'xs' || size === 'sm' ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'
          } ${online ? 'bg-success' : 'bg-base-300'}`}
          aria-label={online ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}