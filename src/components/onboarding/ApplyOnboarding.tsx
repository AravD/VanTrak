import { useEffect, useRef, useState } from 'react';
import { OnboardingShell } from './OnboardingShell';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../app/auth-context';

/**
 * Runs once after a user verifies their email, when they have a session but no
 * membership yet and signup metadata is waiting. Creates the business from the
 * `pending_business_name` captured in the wizard, then refreshes membership so
 * the resolver lets them into the app.
 */
export function ApplyOnboarding() {
  const { session, refreshMembership } = useAuth();
  const ran = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    (async () => {
      const meta = session?.user.user_metadata ?? {};
      const inviteToken = meta.pending_invite_token as string | undefined;
      const businessName = meta.pending_business_name as string | undefined;

      // Invited user: accept the invite (joins the inviter's business with a role).
      if (inviteToken) {
        const { error: rpcError } = await supabase.rpc('accept_invite', { p_token: inviteToken });
        if (rpcError) {
          setError(rpcError.message);
          return;
        }
        await refreshMembership();
        await supabase.auth.updateUser({ data: { pending_invite_token: null } });
        return;
      }

      // New owner: create their business from the signup wizard.
      if (!businessName) return;
      const { error: rpcError } = await supabase.rpc('create_business', {
        p_name: businessName,
        p_full_name: (meta.full_name as string | undefined) ?? null,
      });
      if (rpcError) {
        setError(rpcError.message);
        return;
      }

      // Load the new membership FIRST so the resolver sends them into the app,
      // then clear the marker (tidiness — the membership check already gates it).
      await refreshMembership();
      await supabase.auth.updateUser({ data: { pending_business_name: null } });
    })();
  }, [session, refreshMembership]);

  return (
    <OnboardingShell
      title={error ? 'Something went wrong' : 'Setting things up…'}
      subtitle={error ?? 'Creating your business and getting everything ready.'}
    >
      {error && (
        <button
          type="button"
          onClick={() => {
            ran.current = false;
            setError(null);
            window.location.reload();
          }}
          className="block rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-gray-100"
        >
          Try again
        </button>
      )}
    </OnboardingShell>
  );
}
