import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { OnboardingShell } from './OnboardingShell';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/phone';
import { SIGNUP_EMAIL_KEY } from '../auth/auth-page';
import { DARK_INPUT_CLASS, PANEL_BUTTON_CLASS } from '../auth/AuthLayout';

/**
 * Pre-login signup wizard. Collects profile details + the business name, then
 * sends the verification email LAST — with everything attached as metadata so
 * it can be applied (see ApplyOnboarding) the moment the user clicks the link.
 */
export function SignupDetails() {
  const navigate = useNavigate();
  // Capture once at mount: clearing the stored email after sending must not
  // re-trigger the "no email" redirect guard below.
  const [email] = useState(() => localStorage.getItem(SIGNUP_EMAIL_KEY) ?? '');

  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  // No email captured (e.g. page opened directly) — start over from /entry.
  if (!email) return <Navigate to="/entry" replace />;

  const handleFinalize = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !businessName.trim()) return;
    setError(null);
    setSubmitting(true);

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: window.location.origin,
          data: {
            full_name: fullName.trim(),
            phone: phone.trim() || null,
            // job_title column kept in DB for later — not collected here.
            // Applied after the user verifies (ApplyOnboarding -> create_business).
            pending_business_name: businessName.trim(),
          },
        },
      });
      if (error) {
        setError(error.message);
        return;
      }
      localStorage.removeItem(SIGNUP_EMAIL_KEY);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sent) {
    return (
      <OnboardingShell title="Check your email" subtitle="One last step to complete your sign-up." center>
        <div className="flex flex-col items-center gap-4 text-center">
          <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white">
            <Mail className="size-6" />
          </span>
          <p className="text-sm leading-relaxed text-white/60">
            We sent a confirmation link to{' '}
            <span className="font-medium text-white">{email}</span>. Click it to finish
            creating <span className="font-medium text-white">{businessName}</span> and sign in.
          </p>
          <p className="text-xs text-white/40">
            Didn't get it? Check your spam folder, or{' '}
            <button
              type="button"
              onClick={() => navigate('/entry')}
              className="text-white/70 underline underline-offset-4 transition-colors hover:text-white"
            >
              start over
            </button>
            .
          </p>
        </div>
      </OnboardingShell>
    );
  }

  return (
    <OnboardingShell
      title="Tell us about you"
      subtitle="A few details to set up your account and business."
    >
      <form onSubmit={handleFinalize} className="space-y-4">
        <Field id="full-name" label="Full name">
          <Input
            id="full-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
            autoFocus
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Field id="phone" label="Phone number" optional>
          <Input
            id="phone"
            type="tel"
            inputMode="numeric"
            maxLength={12}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            disabled={submitting}
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <div className="h-px bg-white/10" />

        <Field id="business-name" label="Business name">
          <Input
            id="business-name"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            disabled={submitting}
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={submitting || !fullName.trim() || !businessName.trim()}
          className={PANEL_BUTTON_CLASS}
        >
          {submitting ? 'Sending…' : 'Send email link'}
        </Button>

        {error && <p className="text-xs leading-relaxed text-red-300">{error}</p>}
      </form>

      <button
        type="button"
        onClick={() => navigate('/entry')}
        className="mt-3 block text-sm text-white/55 underline underline-offset-4 transition-colors hover:text-white"
      >
        ← Back
      </button>
    </OnboardingShell>
  );
}

function Field({
  id,
  label,
  optional,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="flex items-center justify-between text-xs font-medium text-white/60">
        {label}
        {optional && <span className="font-normal text-white/35">Optional</span>}
      </label>
      {children}
    </div>
  );
}
