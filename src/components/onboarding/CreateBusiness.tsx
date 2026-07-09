import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { OnboardingShell } from './OnboardingShell';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { formatPhone } from '../../lib/phone';
import { useAuth } from '../../app/auth-context';
import { DARK_INPUT_CLASS, PANEL_BUTTON_CLASS } from '../auth/AuthLayout';

/** §4 — create a new business; the creator becomes its admin (approved). */
export function CreateBusiness() {
  const navigate = useNavigate();
  const { session, refreshMembership } = useAuth();

  const [name, setName] = useState('');
  const [fullName, setFullName] = useState(
    () =>
      (session?.user.user_metadata?.full_name as string | undefined) ??
      (session?.user.user_metadata?.name as string | undefined) ??
      ''
  );
  const [phone, setPhone] = useState('');
  const [jobTitle, setJobTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setError(null);
    setSubmitting(true);

    const { error } = await supabase.rpc('create_business', {
      p_name: name.trim(),
      p_full_name: fullName.trim() || null,
    });

    if (error) {
      setError(error.message);
      setSubmitting(false);
      return;
    }

    // Save the extra profile fields (full_name is set by create_business).
    if (session) {
      await supabase
        .from('profiles')
        .update({ phone: phone.trim() || null, job_title: jobTitle.trim() || null })
        .eq('id', session.user.id);
    }

    // Pull in the new admin/approved membership, then enter the app. No default
    // station is created — the user sets those up on the Schedule page.
    await refreshMembership();
    localStorage.setItem('activePage', 'schedule'); // greet new users on the schedule
    navigate('/', { replace: true });
  };

  return (
    <OnboardingShell
      title="Create a business"
      subtitle="You'll be the admin and can invite your team once it's set up."
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <Field id="biz-name" label="Business name">
          <Input
            id="biz-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="Acme Logistics"
            autoFocus
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Field id="owner-name" label="Your name">
          <Input
            id="owner-name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            disabled={submitting}
            placeholder="Jordan Reyes"
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Field id="owner-phone" label="Phone number" optional>
          <Input
            id="owner-phone"
            type="tel"
            inputMode="numeric"
            maxLength={12}
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            disabled={submitting}
            placeholder="555-123-4567"
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Field id="owner-title" label="Job title" optional>
          <Input
            id="owner-title"
            value={jobTitle}
            onChange={(e) => setJobTitle(e.target.value)}
            disabled={submitting}
            placeholder="Operations Manager"
            className={DARK_INPUT_CLASS}
          />
        </Field>

        <Button
          type="submit"
          size="lg"
          disabled={submitting || !name.trim()}
          className={PANEL_BUTTON_CLASS}
        >
          {submitting ? 'Creating…' : 'Create business'}
        </Button>

        {error && <p className="text-xs leading-relaxed text-red-300">{error}</p>}
      </form>

      <button
        type="button"
        onClick={() => navigate('/signup')}
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
