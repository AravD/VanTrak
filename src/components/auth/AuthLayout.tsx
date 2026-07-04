'use client';

import { type ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';

// Strong ease-out — the built-in CSS curves are too weak to feel intentional.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

/** Per-child entrance variant. Attach to direct children for the stagger. */
export const itemVariants: Variants = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
};

/** Inputs styled for the dark right panel. */
export const DARK_INPUT_CLASS =
  'h-11 rounded-xl border-white/10 bg-white/[0.04] text-white placeholder:text-white/30 ' +
  'focus-visible:ring-white/25 focus-visible:ring-offset-black';

/** Primary (white-on-black) button used across auth + onboarding panels. */
export const PANEL_BUTTON_CLASS =
  'w-full justify-center gap-2 rounded-xl bg-white text-black shadow-sm ' +
  'transition-[transform,background-color,box-shadow] duration-150 ease-out ' +
  'hover:bg-gray-100 hover:shadow-md active:scale-[0.98] ' +
  'focus-visible:ring-white/40 focus-visible:ring-offset-black';

/**
 * Split auth/onboarding shell: animated brand hero on the left, a dark content
 * panel on the right. The right panel grows and scrolls for taller forms while
 * the hero stays pinned. Children are staggered — wrap each in a `motion.*` with
 * `variants={itemVariants}`.
 */
export function AuthLayout({ children }: { children: ReactNode }) {
  const reduce = useReducedMotion();

  const container: Variants = {
    hidden: {},
    show: {
      transition: {
        staggerChildren: reduce ? 0 : 0.06,
        delayChildren: reduce ? 0 : 0.04,
      },
    },
  };

  return (
    <main className="relative min-h-screen lg:grid lg:grid-cols-2">
      {/* Left — brand canvas, pinned full-height on desktop */}
      <div className="relative hidden flex-col overflow-hidden border-r border-gray-100 bg-white p-10 lg:flex lg:sticky lg:top-0 lg:h-screen">
        <motion.p
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: EASE_OUT }}
          className="z-10 font-sans text-3xl font-bold tracking-tight text-black"
        >
          VanTrak
        </motion.p>

        <motion.p
          initial={{ opacity: 0, y: reduce ? 0 : 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.08, ease: EASE_OUT }}
          className="z-10 mt-auto max-w-xs font-sans text-sm font-medium leading-relaxed text-gray-400"
        >
          Driver scheduling and daily operations, all in one place.
        </motion.p>

        <FloatingPaths position={1} animate={!reduce} />
        <FloatingPaths position={-1} animate={!reduce} />

        {/* Soft fade so the paths recede behind the content. */}
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-white via-white/30 to-transparent" />
      </div>

      {/* Right — content panel */}
      <div className="relative flex min-h-screen flex-col bg-black px-6 py-12 text-white">
        {/* Subtle depth glows (visible on black, unlike foreground gradients). */}
        <div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
          <div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)]" />
          <div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_70%)]" />
        </div>

        <motion.div
          variants={container}
          initial="hidden"
          animate="show"
          className="relative z-10 mx-auto my-auto w-full space-y-6 sm:max-w-sm"
        >
          <motion.p variants={itemVariants} className="font-sans text-3xl font-bold tracking-tight lg:hidden">
            VanTrak
          </motion.p>
          {children}
        </motion.div>
      </div>
    </main>
  );
}

function FloatingPaths({ position, animate }: { position: number; animate: boolean }) {
  const paths = Array.from({ length: 36 }, (_, i) => ({
    id: i,
    d: `M-${380 - i * 5 * position} -${189 + i * 6}C-${
      380 - i * 5 * position
    } -${189 + i * 6} -${312 - i * 5 * position} ${216 - i * 6} ${
      152 - i * 5 * position
    } ${343 - i * 6}C${616 - i * 5 * position} ${470 - i * 6} ${
      684 - i * 5 * position
    } ${875 - i * 6} ${684 - i * 5 * position} ${875 - i * 6}`,
    width: 0.5 + i * 0.03,
  }));

  return (
    <div className="pointer-events-none absolute inset-0">
      <svg className="h-full w-full text-slate-900" viewBox="0 0 696 316" fill="none">
        <title>Background Paths</title>
        {paths.map((path) =>
          animate ? (
            <motion.path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.16 + path.id * 0.025}
              initial={{ pathLength: 0.3, opacity: 0.6 }}
              animate={{
                pathLength: 1,
                opacity: [0.4, 0.8, 0.4],
                pathOffset: [0, 1, 0],
              }}
              transition={{
                // Constant decorative motion → linear is correct.
                duration: 20 + Math.random() * 10,
                repeat: Number.POSITIVE_INFINITY,
                ease: 'linear',
              }}
            />
          ) : (
            <path
              key={path.id}
              d={path.d}
              stroke="currentColor"
              strokeWidth={path.width}
              strokeOpacity={0.16 + path.id * 0.025}
            />
          ),
        )}
      </svg>
    </div>
  );
}
