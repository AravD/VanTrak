/**
 * Single source of truth for the permission system.
 *
 * Adding a new permission later = add one entry to a section below, include the
 * key in whichever ROLE_TEMPLATES should have it, then gate the relevant UI with
 * `hasPermission('your.key')`. No schema/migration change is needed — permission
 * sets live in `business_members.permissions` (jsonb).
 */

export interface PermissionDef {
  key: string;
  label: string;
}
export interface PermissionSection {
  title: string;
  permissions: PermissionDef[];
}

/** Editable, grouped catalog — drives the permission editor UI. */
export const PERMISSION_SECTIONS: PermissionSection[] = [
  {
    title: 'Scheduling',
    permissions: [
      { key: 'schedule.view', label: 'View Schedule' },
      { key: 'schedule.edit', label: 'Edit Schedule' },
      { key: 'schedule.move_days', label: 'Move Drivers Between Days' },
      { key: 'schedule.move_stations', label: 'Move Drivers Between Stations' },
      { key: 'timeoff.approve', label: 'Approve Time-Off Requests' },
    ],
  },
  {
    title: 'Drivers',
    permissions: [
      { key: 'drivers.view', label: 'View Drivers' },
      { key: 'drivers.add', label: 'Add Drivers' },
      { key: 'drivers.edit', label: 'Edit Drivers' },
      { key: 'drivers.change_status', label: 'Change Employment Status' },
      { key: 'drivers.delete', label: 'Delete Drivers' },
    ],
  },
  {
    title: 'Daily Reports',
    permissions: [
      { key: 'reports.view', label: 'View Daily Reports' },
      { key: 'reports.export', label: 'View & Export Reports' },
      { key: 'reports.rollcall.edit', label: 'Edit Roll Call' },
      { key: 'reports.operations.edit', label: 'Edit Operations' },
      { key: 'reports.issues.log', label: 'Log Issues' },
    ],
  },
  {
    title: 'Stations',
    permissions: [
      { key: 'stations.view', label: 'View Stations' },
      { key: 'stations.add', label: 'Add Stations' },
      { key: 'stations.edit', label: 'Edit Stations' },
      { key: 'stations.delete', label: 'Delete Stations' },
    ],
  },
  {
    title: 'Administration',
    permissions: [
      { key: 'admin.invite', label: 'Invite Team Members' },
      { key: 'admin.permissions.edit', label: 'Edit User Permissions' },
      { key: 'admin.users.remove', label: 'Remove Users' },
      { key: 'admin.business.edit', label: 'Edit Business Settings' },
    ],
  },
];

/** Owner-only gates. Granted only via `*`, never shown as editable toggles. */
export const OWNER_ONLY_PERMISSIONS = ['business.delete', 'business.transfer', 'billing.manage'] as const;

/** Every assignable permission key (flattened). */
export const ALL_PERMISSIONS: string[] = PERMISSION_SECTIONS.flatMap((s) => s.permissions.map((p) => p.key));

export interface RoleTemplate {
  name: string;
  description: string;
  permissions: string[];
}

/** Built-in starting points for invites. Owner is the business creator, not invitable. */
export const ROLE_TEMPLATES: RoleTemplate[] = [
  {
    name: 'Admin',
    description: 'Full operational access, minus owner-only actions.',
    permissions: [...ALL_PERMISSIONS],
  },
  {
    name: 'HR',
    description: 'Full scheduling plus people management.',
    permissions: [
      'schedule.view', 'schedule.edit', 'schedule.move_days', 'schedule.move_stations', 'timeoff.approve',
      'drivers.view', 'drivers.add', 'drivers.edit', 'drivers.change_status',
      'reports.view', 'reports.rollcall.edit', 'reports.operations.edit', 'reports.issues.log',
      'stations.view',
    ],
  },
  {
    name: 'Dispatcher',
    description: 'Day-to-day schedule editing and roll call.',
    permissions: ['schedule.view', 'schedule.edit', 'schedule.move_days', 'drivers.view', 'reports.view', 'reports.rollcall.edit'],
  },
  {
    name: 'Viewer',
    description: 'Read-only access.',
    permissions: ['schedule.view', 'drivers.view', 'reports.view', 'stations.view'],
  },
];

/** True if `perms` grants `key` (`*` = all; an `x.edit` grant implies `x.view`). */
export function permissionGranted(perms: string[], key: string): boolean {
  if (perms.includes('*')) return true;
  if (perms.includes(key)) return true;
  if (key.endsWith('.view')) return perms.includes(key.replace(/\.view$/, '.edit'));
  return false;
}

/** Human labels for a set of permission keys (for read-only display). */
export const PERMISSION_LABELS: Record<string, string> = Object.fromEntries([
  ['*', 'Full access'],
  ...PERMISSION_SECTIONS.flatMap((s) => s.permissions.map((p) => [p.key, p.label] as const)),
]);
