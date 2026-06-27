/**
 * lib/slices/supportutils.js — small, framework-agnostic helpers shared by support components.
 */
import clsx from 'clsx';

/** Thin wrapper kept so call sites read `cn(...)` like most design systems —
 *  no class-merging library needed since this app's Tailwind classes never collide. */
export function cn(...args) {
  return clsx(...args);
}

/** Truncate a string for previews (ticket list last-message, etc). */
export function truncate(str = '', max = 80) {
  if (!str) return '';
  return str.length > max ? `${str.slice(0, max).trim()}…` : str;
}

/** Initials for avatar placeholders, e.g. "Sarah Khan" -> "SK" */
export function initials(name = '') {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('');
}

/** Bytes -> human readable file size */
export function formatBytes(bytes = 0) {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / 1024 ** i).toFixed(i === 0 ? 0 : 1)} ${units[i]}`;
}

/** Safe getter for nested user display name from a populated ref or raw id */
export function displayName(entity, fallback = 'Unknown') {
  if (!entity) return fallback;
  if (typeof entity === 'string') return fallback;
  return entity.name || entity.email || fallback;
}

/** Build a query string from a params object, skipping empty/undefined values */
export function toQueryString(params = {}) {
  const usp = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') usp.set(k, v);
  });
  const qs = usp.toString();
  return qs ? `?${qs}` : '';
}

/** Generate a stable cache key for a filter object (used for list/analytics caching) */
export function cacheKeyFor(prefix, params = {}) {
  return `${prefix}:${JSON.stringify(params, Object.keys(params).sort())}`;
}
