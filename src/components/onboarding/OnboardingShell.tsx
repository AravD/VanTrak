import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { AuthLayout, itemVariants } from '../auth/AuthLayout';
import { useAuth } from '../../app/auth-context';

interface OnboardingShellProps {
  title: string;
  subtitle?: string;
  /** Center the title/subtitle (for confirmation-style screens). */
  center?: boolean;
  children?: ReactNode;
}

/**
 * Onboarding screens (signup wizard, create/join, pending) rendered inside the
 * shared split layout, so the form sits in the same spot as the sign-in panel.
 */
export function OnboardingShell({ title, subtitle, center, children }: OnboardingShellProps) {
  const { signOut, session } = useAuth();

  return (
    <AuthLayout>
      <motion.div variants={itemVariants} className={`space-y-1.5${center ? ' text-center' : ''}`}>
        <h1 className="font-heading text-3xl font-bold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-white/55">{subtitle}</p>}
      </motion.div>

      <motion.div variants={itemVariants}>{children}</motion.div>

      {session && (
        <motion.div variants={itemVariants}>
          <button
            type="button"
            onClick={signOut}
            className="mx-auto block text-xs text-white/40 underline underline-offset-4 transition-colors hover:text-white/70"
          >
            Sign out
          </button>
        </motion.div>
      )}
    </AuthLayout>
  );
}
