'use client';

export function AvatarWithStatus({ name, avatarUrl, isOnline, size = 'md', role }) {
  const initials = name
    ? name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
    : '?';

  const sizeClass = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-sm',
    lg: 'w-12 h-12 text-base',
    xl: 'w-16 h-16 text-lg',
  }[size] || 'w-10 h-10 text-sm';

  const dotSize = {
    xs: 'w-1.5 h-1.5',
    sm: 'w-2 h-2',
    md: 'w-2.5 h-2.5',
    lg: 'w-3 h-3',
    xl: 'w-3.5 h-3.5',
  }[size] || 'w-2.5 h-2.5';

  return (
    <div className="relative inline-flex flex-shrink-0">
      <div className={`${sizeClass} rounded-full overflow-hidden bg-primary/10 flex items-center justify-center font-bold text-primary`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <span>{initials}</span>
        )}
      </div>
      {isOnline !== undefined && (
        <span
          className={`absolute bottom-0 right-0 ${dotSize} rounded-full border-2 border-base-100 ${
            isOnline ? 'bg-success' : 'bg-base-300'
          }`}
          aria-label={isOnline ? 'Online' : 'Offline'}
        />
      )}
    </div>
  );
}
