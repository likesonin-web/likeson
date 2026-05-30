'use client';
import { Stethoscope, User, Shield, HeartHandshake } from 'lucide-react';
import { getRoleLabel } from '../../utils/roleHelpers';

const ROLE_ICONS = {
  doctor:         Stethoscope,
  customer:       User,
  admin:          Shield,
  superadmin:     Shield,
  care_assistant: HeartHandshake,
};

export function RoleBadge({ role, size = 'sm' }) {
  const Icon  = ROLE_ICONS[role] || User;
  const label = getRoleLabel(role);

  return (
    <span className="role-badge">
      <Icon size={size === 'xs' ? 10 : 12} />
      {label}
    </span>
  );
}
