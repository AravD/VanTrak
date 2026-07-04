import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { permissionGranted, ROLE_TEMPLATES } from '../lib/permissions';

export type MemberStatus = 'pending' | 'approved' | 'rejected';

export interface Membership {
  businessId: string;
  status: MemberStatus;
  /** The member's role label in this business (e.g. "Owner", "Dispatcher"). */
  roleName: string | null;
  /** The member's own permission keys. `["*"]` means everything. */
  permissions: string[];
}

interface AuthState {
  /** True until the initial session + membership lookup has resolved. */
  loading: boolean;
  session: Session | null;
  /** Local "continue as guest" bypass — no Supabase session, full access. */
  isGuest: boolean;
  /** The user's membership in their business (null for guests / not-yet-joined). */
  membership: Membership | null;
  /** Effective permission keys (respects any active role preview). Guests get `["*"]`. */
  permissions: string[];
  /** Convenience check, e.g. `hasPermission('schedule.edit')`. */
  hasPermission: (perm: string) => boolean;
  /** Signed in via Supabase, OR using the guest bypass. */
  isAuthenticated: boolean;
  /** Whether this user may "view as" other roles (full-access / admins). */
  canPreviewRoles: boolean;
  /** Active preview template name, or null for the user's real permissions. */
  previewRole: string | null;
  setPreviewRole: (role: string | null) => void;
  continueAsGuest: () => void;
  refreshMembership: () => Promise<void>;
  signOut: () => Promise<void>;
}

const GUEST_KEY = 'vt_guest';

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isGuest, setIsGuest] = useState(
    () => localStorage.getItem(GUEST_KEY) === 'true'
  );
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  // Dev/owner "view as role" override — UI-only, resets on reload.
  const [previewRole, setPreviewRole] = useState<string | null>(null);

  const loadMembership = async (userId: string) => {
    // RLS lets a user read their own membership rows. MVP: one business per user.
    const { data } = await supabase
      .from('business_members')
      .select('business_id, status, role_name, permissions')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!data) {
      setMembership(null);
      return;
    }

    setMembership({
      businessId: data.business_id,
      status: data.status,
      roleName: (data.role_name as string | null) ?? null,
      permissions: (data.permissions as string[] | null) ?? [],
    });
  };

  useEffect(() => {
    let active = true;

    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      if (data.session) await loadMembership(data.session.user.id);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      // Defer Supabase calls out of the callback to avoid auth-lock deadlocks.
      if (next) setTimeout(() => loadMembership(next.user.id), 0);
      else setMembership(null);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const continueAsGuest = () => {
    localStorage.setItem(GUEST_KEY, 'true');
    setIsGuest(true);
  };

  const refreshMembership = async () => {
    if (session) await loadMembership(session.user.id);
  };

  const signOut = async () => {
    localStorage.removeItem(GUEST_KEY);
    setIsGuest(false);
    setMembership(null);
    await supabase.auth.signOut();
  };

  const basePermissions = isGuest ? ['*'] : membership?.permissions ?? [];
  // Only owners / admins may preview other roles.
  const canPreviewRoles =
    basePermissions.includes('*') || permissionGranted(basePermissions, 'admin.permissions.edit');

  const previewPermissions =
    previewRole === 'Owner'
      ? ['*']
      : previewRole
      ? ROLE_TEMPLATES.find((t) => t.name === previewRole)?.permissions ?? []
      : null;

  // Effective permissions used everywhere: the preview override if active & allowed.
  const permissions = canPreviewRoles && previewPermissions ? previewPermissions : basePermissions;

  const value: AuthState = {
    loading,
    session,
    isGuest,
    membership,
    permissions,
    hasPermission: (perm: string) => permissionGranted(permissions, perm),
    isAuthenticated: isGuest || !!session,
    canPreviewRoles,
    previewRole,
    setPreviewRole,
    continueAsGuest,
    refreshMembership,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
