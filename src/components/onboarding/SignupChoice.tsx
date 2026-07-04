import { useNavigate } from 'react-router-dom';
import { Building2, Users } from 'lucide-react';
import { OnboardingShell } from './OnboardingShell';

/** §3 — the fork after signing up: create a business or join one. */
export function SignupChoice() {
  const navigate = useNavigate();

  return (
    <OnboardingShell
      title="Get started"
      subtitle="Set up a new company, or join one that already exists."
    >
      <div className="space-y-3">
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

        <button
          type="button"
          onClick={() => navigate('/join-business')}
          className="flex w-full items-center gap-4 rounded-xl border border-white/10 bg-white/[0.04] p-4 text-left transition-all hover:border-white/20 hover:bg-white/[0.07] active:scale-[0.99]"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/10 text-white">
            <Users className="size-5" />
          </span>
          <span>
            <span className="block text-sm font-semibold text-white">Join an existing business</span>
            <span className="block text-xs text-white/55">Enter an invite code from your admin.</span>
          </span>
        </button>
      </div>
    </OnboardingShell>
  );
}
