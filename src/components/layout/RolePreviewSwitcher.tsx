import { Eye, X } from 'lucide-react';
import { useAuth } from '../../app/auth-context';
import { ROLE_TEMPLATES } from '../../lib/permissions';
import { cn } from '../../lib/utils';

const PREVIEW_OPTIONS = ['Owner', ...ROLE_TEMPLATES.map((t) => t.name)];

/**
 * Owner/admin dev tool: preview the app's UI as any role without a separate
 * account. It overrides only the *effective UI permissions* — the server still
 * enforces your real permissions, so this shows what a role would SEE, not a
 * true sandbox.
 */
export function RolePreviewSwitcher() {
  const { canPreviewRoles, previewRole, setPreviewRole } = useAuth();
  if (!canPreviewRoles) return null;

  const active = previewRole !== null;

  return (
    <div
      className={cn(
        'fixed bottom-4 left-20 z-50 flex items-center gap-2 rounded-full border py-1.5 pl-3 pr-1.5 shadow-lg backdrop-blur transition-colors',
        active ? 'border-amber-300 bg-amber-50/95' : 'border-gray-200 bg-white/95'
      )}
    >
      <Eye className={cn('size-3.5', active ? 'text-amber-600' : 'text-gray-400')} />
      <span className={cn('text-xs font-medium', active ? 'text-amber-700' : 'text-gray-500')}>
        {active ? 'Viewing as' : 'View as'}
      </span>
      <select
        value={previewRole ?? ''}
        onChange={(e) => setPreviewRole(e.target.value || null)}
        className={cn(
          'cursor-pointer rounded-md bg-transparent py-0.5 pl-1 pr-1 text-xs font-semibold outline-none',
          active ? 'text-amber-800' : 'text-black'
        )}
      >
        <option value="">Your role</option>
        {PREVIEW_OPTIONS.map((o) => (
          <option key={o} value={o}>
            {o}
          </option>
        ))}
      </select>
      {active && (
        <button
          type="button"
          onClick={() => setPreviewRole(null)}
          title="Exit preview"
          className="rounded-full p-1 text-amber-600 transition-colors hover:bg-amber-100 active:scale-95"
        >
          <X className="size-3.5" />
        </button>
      )}
    </div>
  );
}
