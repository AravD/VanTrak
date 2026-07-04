import { Clock } from 'lucide-react';
import { OnboardingShell } from './OnboardingShell';
import { useAuth } from '../../app/auth-context';
import { PANEL_BUTTON_CLASS } from '../auth/AuthLayout';
import { Button } from '../ui/button';

/** §5 — shown to members whose status is still `pending`. */
export function PendingApproval() {
  const { refreshMembership } = useAuth();

  return (
    <OnboardingShell
      title="Waiting for approval"
      subtitle="An admin needs to approve your request before you can access this business."
    >
      <div className="flex flex-col items-center gap-4 py-2">
        <span className="flex size-12 items-center justify-center rounded-full bg-white/10 text-white/70">
          <Clock className="size-6" />
        </span>
        <Button type="button" size="lg" onClick={refreshMembership} className={PANEL_BUTTON_CLASS}>
          Check again
        </Button>
      </div>
    </OnboardingShell>
  );
}
