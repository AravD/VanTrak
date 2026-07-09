import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { OnboardingShell } from './OnboardingShell';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/phone';
import { useAuth } from '../../app/auth-context';
import { PANEL_BUTTON_CLASS, DARK_INPUT_CLASS } from '../auth/AuthLayout';

interface InvitePreview {
  business_name: string;
  role_name: string;
  email: string;
  status: string;
}

/**
 * Public landing for an invite link (/invite/:token). Collects the joiner's
 * name (required) + phone (optional), then:
 *   - signed-in users: saves them to the profile and accepts immediately.
 *   - signed-out users: carries them in the sign-up metadata via the magic link;
 *     ApplyOnboarding calls accept_invite on return.
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

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');

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

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const nameReady = firstName.trim().length > 0 && lastName.trim().length > 0;

  const acceptNow = async () => {
    if (!token) return;
    setError(null);
    setWorking(true);
    // Save the joiner's details on their profile before joining.
    const uid = session?.user.id;
    if (uid) {
      await supabase.from('profiles').update({ full_name: fullName, phone: phone.trim() || null }).eq('id', uid);
    }
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
        data: { full_name: fullName, phone: phone.trim() || null, pending_invite_token: token },
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
      subtitle={`You've been invited as ${invite.role_name}. Tell us who you are to get started.`}
    >
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-sm">
          <span className="text-white/50">Invite for </span>
          <span className="font-medium text-white">{invite.email}</span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label htmlFor="first" className="block text-xs font-medium text-white/60">First name</label>
            <Input id="first" value={firstName} onChange={(e) => setFirstName(e.target.value)} disabled={working} autoFocus className={DARK_INPUT_CLASS} />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="last" className="block text-xs font-medium text-white/60">Last name</label>
            <Input id="last" value={lastName} onChange={(e) => setLastName(e.target.value)} disabled={working} className={DARK_INPUT_CLASS} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="phone" className="flex items-center justify-between text-xs font-medium text-white/60">
            Phone number <span className="font-normal text-white/35">Optional</span>
          </label>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={12}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            disabled={working}
            className={DARK_INPUT_CLASS}
          />
        </div>

        <Button
          onClick={session ? acceptNow : acceptViaEmail}
          disabled={working || !nameReady}
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
