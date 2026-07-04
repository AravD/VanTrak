import { useNavigate } from 'react-router-dom';
import { OnboardingShell } from './OnboardingShell';

/** §5 — placeholder. Wired to join_business() RPC in a later step. */
export function JoinBusiness() {
  const navigate = useNavigate();

  return (
    <OnboardingShell
      title="Join a business"
      subtitle="This is where the invite-code form will live (§5)."
    >
      <button
        type="button"
        onClick={() => navigate('/signup')}
        className="block text-sm text-white/55 underline underline-offset-4 transition-colors hover:text-white"
      >
        ← Back
      </button>
    </OnboardingShell>
  );
}
