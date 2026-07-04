import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OnboardingShell } from './OnboardingShell';
import { Button } from '../ui/button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../app/auth-context';
import { PANEL_BUTTON_CLASS } from '../auth/AuthLayout';

interface InvitePreview {
  business_name: string;
  role_name: string;
  email: string;
  status: string;
}

/**
 * Public landing for an invite link (/invite/:token). Signed-out users get a
 * magic link carrying the token; on return, ApplyOnboarding calls accept_invite.
 * Signed-in users accept immediately.
 */
export function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { session, refreshMembership } = useAuth();

  const [invite, setInvite] = useState<InvitePreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    (async () => {
      if (!token) {
        setLoading(false);
        return;
      }
      const { data } = await supabase.rpc('get_invite', { p_token: token });
      const row = (Array.isArray(data) ? data[0] : data) as InvitePreview | undefined;
      setInvite(row ?? null);
      setLoading(false);
    })();
  }, [token]);

  const acceptNow = async () => {
    if (!token) return;
    setError(null);
    setWorking(true);
    const { error } = await supabase.rpc('accept_invite', { p_token: token });
    if (error) {
      setError(error.message);
      setWorking(false);
      return;
    }
    await refreshMembership();
    navigate('/', { replace: true });
  };

  const acceptViaEmail = async () => {
    if (!invite || !token) return;
    setError(null);
    setWorking(true);
    const { error } = await supabase.auth.signInWithOtp({
      email: invite.email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: window.location.origin,
        data: { pending_invite_token: token },
      },
    });
    setWorking(false);
    if (error) {
      setError(error.message);
      return;
    }
    setSent(true);
  };

  if (loading) return <OnboardingShell title="Loading invite…" />;

  if (!invite || invite.status !== 'pending') {
    return (
      <OnboardingShell
        title="Invite unavailable"
        subtitle="This invite link is invalid, expired, or already used."
        center
      >
        <Button onClick={() => navigate('/entry')} size="lg" className={PANEL_BUTTON_CLASS}>
          Go to sign in
        </Button>
      </OnboardingShell>
    );
  }

  if (sent) {
    return (
      <OnboardingShell title="Check your email" subtitle={`We sent a sign-in link to ${invite.email}.`} center>
        <p className="text-sm leading-relaxed text-white/55">
          Click it to join <span className="font-medium text-white">{invite.business_name}</span>.
        </p>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      title={`Join ${invite.business_name}`}
      subtitle={`You've been invited as ${invite.role_name}.`}
    >
      <div className="space-y-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <span className="text-white/50">Invite for </span>
          <span className="font-medium text-white">{invite.email}</span>
        </div>

        <Button
          onClick={session ? acceptNow : acceptViaEmail}
          disabled={working}
          size="lg"
          className={PANEL_BUTTON_CLASS}
        >
          {working ? (session ? 'Joining…' : 'Sending…') : session ? `Join ${invite.business_name}` : 'Accept & continue'}
        </Button>

        {error && <p className="text-xs leading-relaxed text-red-300">{error}</p>}
      </div>
    </OnboardingShell>
  );
}
