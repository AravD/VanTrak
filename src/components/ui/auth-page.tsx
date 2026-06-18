'use client';

import React from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Button } from './button';

import { AppleIcon, AtSignIcon } from 'lucide-react';
import { Input } from './input';

interface AuthPageProps {
	/**
	 * Called when the user chooses any sign-in method. Real authentication and
	 * role assignment will be wired up later — for now this just lets the app
	 * move past the landing page.
	 */
	onAuthenticated?: () => void;
}

// Strong ease-out — the built-in CSS curves are too weak to feel intentional.
const EASE_OUT = [0.23, 1, 0.32, 1] as const;

const BUTTON_CLASS =
	'w-full justify-center gap-2 rounded-xl bg-white text-black shadow-sm ' +
	'transition-[transform,background-color,box-shadow] duration-150 ease-out ' +
	'hover:bg-gray-100 hover:shadow-md active:scale-[0.98] ' +
	'focus-visible:ring-white/40 focus-visible:ring-offset-black';

const PROVIDERS = [
	{ Icon: GoogleIcon, label: 'Continue with Google' },
	{ Icon: AppleIcon, label: 'Continue with Apple' },
] as const;

export function AuthPage({ onAuthenticated }: AuthPageProps) {
	const reduce = useReducedMotion();

	// Staggered entrance. One-time view, so a little delight is warranted.
	const container: Variants = {
		hidden: {},
		show: {
			transition: {
				staggerChildren: reduce ? 0 : 0.06,
				delayChildren: reduce ? 0 : 0.04,
			},
		},
	};
	const item: Variants = {
		hidden: { opacity: 0, y: reduce ? 0 : 10 },
		show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } },
	};

	return (
		<main className="relative min-h-screen lg:grid lg:grid-cols-2 lg:h-screen lg:overflow-hidden">
			{/* Left — brand canvas */}
			<div className="relative hidden h-full flex-col overflow-hidden border-r border-gray-100 bg-white p-10 lg:flex">
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

			{/* Right — sign in */}
			<div className="relative flex min-h-screen flex-col justify-center overflow-hidden bg-black p-6 text-white">
				{/* Subtle depth glows (visible on black, unlike foreground-based gradients). */}
				<div aria-hidden className="pointer-events-none absolute inset-0 opacity-70">
					<div className="absolute -top-24 right-0 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.08),transparent_70%)]" />
					<div className="absolute bottom-0 left-1/4 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.04),transparent_70%)]" />
				</div>

				<motion.div
					variants={container}
					initial="hidden"
					animate="show"
					className="relative z-10 mx-auto w-full space-y-6 sm:max-w-sm"
				>
					<motion.p variants={item} className="font-sans text-3xl font-bold tracking-tight lg:hidden">
						VanTrak
					</motion.p>

					<motion.div variants={item} className="space-y-1.5">
						<h1 className="font-heading text-3xl font-bold tracking-tight">
							Sign in or join
						</h1>
						<p className="text-sm text-white/55">
							Use a provider or your email to continue.
						</p>
					</motion.div>

					<motion.div variants={item} className="space-y-2.5">
						{PROVIDERS.map(({ Icon, label }) => (
							<Button
								key={label}
								type="button"
								size="lg"
								onClick={onAuthenticated}
								className={BUTTON_CLASS}
							>
								<Icon className="size-4" />
								{label}
							</Button>
						))}
					</motion.div>

					<motion.div variants={item}>
						<AuthSeparator />
					</motion.div>

					<motion.form
						variants={item}
						className="space-y-2.5"
						onSubmit={(e) => {
							e.preventDefault();
							onAuthenticated?.();
						}}
					>
						<label htmlFor="email" className="block text-xs text-white/50">
							Enter your email to sign in or create an account
						</label>
						<div className="relative">
							<Input
								id="email"
								type="email"
								placeholder="your.email@example.com"
								className="peer h-11 rounded-xl border-white/10 bg-white/[0.04] ps-9 text-white placeholder:text-white/30 focus-visible:ring-white/25 focus-visible:ring-offset-black"
							/>
							<div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-white/40 peer-focus:text-white/70">
								<AtSignIcon className="size-4" aria-hidden="true" />
							</div>
						</div>

						<Button type="submit" size="lg" className={BUTTON_CLASS}>
							Continue with email
						</Button>
					</motion.form>

					<motion.p variants={item} className="text-xs leading-relaxed text-white/40">
						By continuing, you agree to our{' '}
						<a href="#" className="text-white/70 underline underline-offset-4 transition-colors hover:text-white">
							Terms of Service
						</a>{' '}
						and{' '}
						<a href="#" className="text-white/70 underline underline-offset-4 transition-colors hover:text-white">
							Privacy Policy
						</a>
						.
					</motion.p>
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
			<svg
				className="h-full w-full text-slate-900"
				viewBox="0 0 696 316"
				fill="none"
			>
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

function GoogleIcon(props: React.ComponentProps<'svg'>) {
	return (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox="0 0 24 24"
			fill="currentColor"
			{...props}
		>
			<g>
				<path d="M12.479,14.265v-3.279h11.049c0.108,0.571,0.164,1.247,0.164,1.979c0,2.46-0.672,5.502-2.84,7.669   C18.744,22.829,16.051,24,12.483,24C5.869,24,0.308,18.613,0.308,12S5.869,0,12.483,0c3.659,0,6.265,1.436,8.223,3.307L18.392,5.62   c-1.404-1.317-3.307-2.341-5.913-2.341C7.65,3.279,3.873,7.171,3.873,12s3.777,8.721,8.606,8.721c3.132,0,4.916-1.258,6.059-2.401   c0.927-0.927,1.537-2.251,1.777-4.059L12.479,14.265z" />
			</g>
		</svg>
	);
}

const AuthSeparator = () => {
	return (
		<div className="flex w-full items-center gap-3">
			<div className="h-px w-full bg-white/10" />
			<span className="text-xs uppercase tracking-widest text-white/40">or</span>
			<div className="h-px w-full bg-white/10" />
		</div>
	);
};
