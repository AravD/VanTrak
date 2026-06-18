import { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface PageHeaderProps {
  title: string;
  /** Inline element shown immediately to the right of the title (left cluster). */
  adornment?: ReactNode;
  /** Right-aligned actions (buttons, navigation, etc.). */
  children?: ReactNode;
  /** Override header classes (e.g. a tighter `mb-*`); merged via tailwind-merge. */
  className?: string;
}

/**
 * Shared page header so every top-level page aligns identically:
 * a Space Grotesk display title on the left (optionally with inline actions),
 * and right-aligned actions/navigation.
 */
export function PageHeader({ title, adornment, children, className }: PageHeaderProps) {
  return (
    <header className={cn('flex justify-between items-center gap-4 mb-10', className)}>
      <div className="flex items-center gap-4">
        <h1 className="font-display text-4xl font-bold tracking-tight text-black">{title}</h1>
        {adornment}
      </div>
      {children && <div className="flex items-center gap-2">{children}</div>}
    </header>
  );
}
