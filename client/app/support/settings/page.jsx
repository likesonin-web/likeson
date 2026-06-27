'use client';

/**
 * app/support/settings/page.jsx
 * Lightweight module-local preferences (desktop notifications, sound)
 * plus a read-only summary of role permissions — all heavy identity/
 * profile settings remain owned by the existing account settings page.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Bell, Volume2, Info } from 'lucide-react';

import useRolePermissions from '../../../hooks/useRolePermissions';
import { ROLE_LABELS } from '../../../lib/supportconstants';

function Toggle({ checked, onChange, label, description }) {
  return (
    <label className="flex items-center justify-between gap-4 py-3 border-b border-base-300 last:border-0 cursor-pointer">
      <div>
        <p className="text-sm font-semibold">{label}</p>
        {description && <p className="text-xs text-base-content/50">{description}</p>}
      </div>
      <input type="checkbox" className="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
    </label>
  );
}

export default function SupportSettingsPage() {
  const { role, permissions } = useRolePermissions();
  const [desktopNotifs, setDesktopNotifs] = useState(true);
  const [soundAlerts, setSoundAlerts] = useState(true);

  return (
    <div className="h-full overflow-y-auto scrollbar-thin p-5 lg:p-8 max-w-2xl space-y-8">
      <div>
        <h2 className="font-extrabold">Support Settings</h2>
        <p className="section-subheading mb-0">Preferences scoped to the Support module.</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card p-5">
        <h6 className="font-bold mb-2 flex items-center gap-2"><Bell className="w-4 h-4" /> Notifications</h6>
        <Toggle checked={desktopNotifs} onChange={setDesktopNotifs} label="Desktop notifications" description="Show a system notification for new ticket messages." />
        <Toggle checked={soundAlerts} onChange={setSoundAlerts} label="Sound alerts" description="Play a short chime on new messages and escalations." icon={Volume2} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="card p-5">
        <h6 className="font-bold mb-3 flex items-center gap-2"><Info className="w-4 h-4" /> Your Access Level</h6>
        <span className="role-badge mb-3 inline-flex">{ROLE_LABELS[role] || role}</span>
        <ul className="text-sm text-base-content/70 space-y-1.5 mt-2">
          {Object.entries(permissions)
            .filter(([, v]) => v)
            .map(([key]) => (
              <li key={key} className="flex items-center gap-2">
                <span className="status-dot status-dot-success" /> {key.replace(/([A-Z])/g, ' $1')}
              </li>
            ))}
        </ul>
      </motion.div>
    </div>
  );
}
