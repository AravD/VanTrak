import { useNavigate } from 'react-router-dom';
import { Building2 } from 'lucide-react';
import { OnboardingShell } from './OnboardingShell';

/**
 * Post-signup landing for users who arrive without a business (e.g. Google).
 * Joining an existing business happens via an email invite link, not here.
 */
export function SignupChoice() {
  const navigate = useNavigate();

  return (
    <OnboardingShell title="Get started" subtitle="Set up your business to start using VanTrak.">
      <button
        type="button"
        onClick={() => navigate('/create-business')}
        className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.99]"
      >
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white text-black">
          <Building2 className="size-5" />
        </span>
        <span>
          <span className="block text-sm font-semibold text-white">Create a new business</span>
          <span className="block text-xs text-white/55">You'll be the admin and can invite your team.</span>
        </span>
      </button>
    </OnboardingShell>
  );
}
