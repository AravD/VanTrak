'use client';

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Button } from '../ui/button';

import { AtSignIcon, UserRound } from 'lucide-react';
import { Input } from '../ui/input';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../app/auth-context';
import {
  AuthLayout,
  itemVariants,
  PANEL_BUTTON_CLASS as BUTTON_CLASS,
} from './AuthLayout';

// Carries the typed email from the entry page into the signup details wizard.
export const SIGNUP_EMAIL_KEY = 'vt_signup_email';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const PROVIDERS = [
  { id: 'google', Icon: GoogleIcon, label: 'Continue with Google' },
] as const;

type Provider = (typeof PROVIDERS)[number]['id'];

export function AuthPage() {
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();

  // `pending` holds whichever action is mid-flight ('google' | 'email' | …)
  // so we can disable the form and show inline progress.
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const handleOAuth = async (provider: Provider) => {
    setError(null);
    setPending(provider);
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: window.location.origin },
    });
    // On success the browser redirects to the provider, so we only land
    // here when something went wrong (e.g. provider not yet enabled).
    if (error) {
      setError(error.message);
      setPending(null);
    }
  };

  // One email field for both flows: try to sign in an EXISTING account
  // (without creating one). If Supabase reports no such account, send them
  // into the signup wizard instead.
  const handleContinue = async (e: React.FormEvent) => {
    e.preventDefault();
    const value = email.trim();
    if (!value) return;
    if (!EMAIL_RE.test(value)) {
      setError('Enter a valid email address.');
      return;
    }
    setError(null);
    setPending('email');

    const { error } = await supabase.auth.signInWithOtp({
      email: value,
      options: { shouldCreateUser: false, emailRedirectTo: window.location.origin },
    });
    setPending(null);

    if (!error) {
      // Account exists -> we just emailed them a sign-in link.
      setMagicLinkSent(true);
      return;
    }

    // otp_disabled / 422 == no account for this email -> start a fresh signup.
    if (error.code === 'otp_disabled' || error.status === 422) {
      localStorage.setItem(SIGNUP_EMAIL_KEY, value);
      navigate('/signup/details');
      return;
    }

    setError(error.message);
  };

  // Guest bypass: no account, no Supabase session — straight into the app with
  // full admin access. (Will need a real/demo data path once §7 scopes data.)
  const handleGuest = () => {
    continueAsGuest();
    navigate('/', { replace: true });
  };

  return (
    <AuthLayout>
      <motion.div variants={itemVariants} className="space-y-1.5">
        <h1 className="font-heading text-3xl font-bold tracking-tight">Sign in or join</h1>
        <p className="text-sm text-white/55">Enter your email or use a provider to continue.</p>
      </motion.div>

      <motion.form variants={itemVariants} className="space-y-2.5" onSubmit={handleContinue}>
        <label htmlFor="email" className="block text-xs text-white/50">
          Enter your email to sign in or create an account
        </label>
        <div className="relative">
          <Input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={pending !== null}
            placeholder="your.email@example.com"
            className="peer h-11 rounded-xl border-white/10 bg-white/[0.04] ps-9 text-white placeholder:text-white/30 focus-visible:ring-white/25 focus-visible:ring-offset-black"
          />
          <div className="pointer-events-none absolute inset-y-0 start-0 flex items-center ps-3 text-white/40 peer-focus:text-white/70">
            <AtSignIcon className="size-4" aria-hidden="true" />
          </div>
        </div>

        <Button type="submit" size="lg" disabled={pending !== null || !email.trim()} className={BUTTON_CLASS}>
          {pending === 'email' ? 'Checking…' : 'Continue'}
        </Button>
      </motion.form>

      {error && (
        <motion.p variants={itemVariants} className="text-xs leading-relaxed text-red-300">
          {error}
        </motion.p>
      )}

      {magicLinkSent && (
        <motion.p variants={itemVariants} className="text-xs leading-relaxed text-emerald-300">
          Check your inbox — we sent a sign-in link to {email}.
        </motion.p>
      )}

      <motion.div variants={itemVariants}>
        <AuthSeparator />
      </motion.div>

      <motion.div variants={itemVariants} className="space-y-2.5">
        {PROVIDERS.map(({ id, Icon, label }) => (
          <Button
            key={id}
            type="button"
            size="lg"
            disabled={pending !== null}
            onClick={() => handleOAuth(id)}
            className={BUTTON_CLASS}
          >
            <Icon className="size-4" />
            {pending === id ? 'Redirecting…' : label}
          </Button>
        ))}

        <Button
          type="button"
          size="lg"
          disabled={pending !== null}
          onClick={handleGuest}
          className={BUTTON_CLASS}
        >
          <UserRound className="size-4" />
          Continue as guest
        </Button>
      </motion.div>

      <motion.p variants={itemVariants} className="text-xs leading-relaxed text-white/40">
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
    </AuthLayout>
  );
}

function GoogleIcon(props: React.ComponentProps<'svg'>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
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
