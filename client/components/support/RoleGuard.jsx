'use client';

/**
 * components/support/RoleGuard.jsx
 * Declarative permission gate.
 *
 *   <RoleGuard permission="viewAnalytics">
 *     <AnalyticsDashboard />
 *   </RoleGuard>
 */
import useRolePermissions from '../../hooks/useRolePermissions';

export default function RoleGuard({ permission, anyOf, allOf, fallback = null, children }) {
  const { permissions } = useRolePermissions();

  let allowed = true;
  if (permission)    allowed = !!permissions[permission];
  if (anyOf?.length) allowed = anyOf.some((key) => permissions[key]);
  if (allOf?.length) allowed = allOf.every((key) => permissions[key]);

  return allowed ? children : fallback;
}