'use client';

/**
 * hooks/useRolePermissions.js
 * Reuses the EXISTING userSlice for identity — does not duplicate the role system.
 */
import { useMemo } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '../store/slices/userSlice';
import { buildPermissionMap, isAdmin, isStaffAdmin, isFinance, isSuperAdmin, isPartner, isCustomer } from '../lib/permissions';

export default function useRolePermissions() {
  const user = useSelector(selectCurrentUser);
  const role = user?.role;

  return useMemo(
    () => ({
      role,
      user,
      permissions: buildPermissionMap(role),
      isAdmin: isAdmin(role),
      isStaffAdmin: isStaffAdmin(role),
      isFinance: isFinance(role),
      isSuperAdmin: isSuperAdmin(role),
      isPartner: isPartner(role),
      isCustomer: isCustomer(role),
    }),
    [role, user]
  );
}
