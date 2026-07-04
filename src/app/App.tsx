import type { ReactElement } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './auth-context';
import { AppShell } from './AppShell';
import { AuthPage } from '../components/auth/auth-page';
import { SignupChoice } from '../components/onboarding/SignupChoice';
import { SignupDetails } from '../components/onboarding/SignupDetails';
import { AcceptInvite } from '../components/onboarding/AcceptInvite';
import { ApplyOnboarding } from '../components/onboarding/ApplyOnboarding';
import { CreateBusiness } from '../components/onboarding/CreateBusiness';
import { JoinBusiness } from '../components/onboarding/JoinBusiness';
import { PendingApproval } from '../components/onboarding/PendingApproval';

// Neutral splash while the initial session/membership lookup resolves — avoids
// flashing the landing page on reload for already-signed-in users.
const Splash = () => <div className="min-h-screen bg-[#FAFAFA]" />;

// ── TEMP DEV PREVIEW ─────────────────────────────────────────────────────────
// Lets you open the onboarding/business pages WITHOUT signing in, just to view
// the UI. Visit `/signup?preview=1` to turn it on (persists via localStorage);
// add `?preview=0` to turn it off. Hard-gated to dev — always false in a prod
// build. REMOVE this and its use in RequireOnboarding before shipping.
function isOnboardingPreview(): boolean {
  if (!import.meta.env.DEV) return false;
  const param = new URLSearchParams(window.location.search).get('preview');
  if (param === '1') localStorage.setItem('vt_preview', '1');
  if (param === '0') localStorage.removeItem('vt_preview');
  return localStorage.getItem('vt_preview') === '1';
}
// ─────────────────────────────────────────────────────────────────────────────

/** Main app: requires an approved member, OR the guest bypass (full admin). */
function RequireApp({ children }: { children: ReactElement }) {
  const { loading, isAuthenticated, isGuest, session, membership } = useAuth();
  if (loading) return <Splash />;
  if (!isAuthenticated) return <Navigate to="/entry" replace />;
  if (isGuest) return children;
  if (!membership) {
    // Just verified their email → finish the pending action (create a business
    // from the signup wizard, or accept an invite) before entering the app.
    const meta = session?.user.user_metadata;
    if (meta?.pending_business_name || meta?.pending_invite_token) return <ApplyOnboarding />;
    return <Navigate to="/signup" replace />;
  }
  if (membership.status !== 'approved') return <Navigate to="/pending-approval" replace />;
  return children;
}

/** Pre-login signup wizard: only reachable when not signed in / not a guest. */
function RequireNoSession({ children }: { children: ReactElement }) {
  const { loading, isAuthenticated } = useAuth();
  if (loading) return <Splash />;
  if (isAuthenticated) return <Navigate to="/" replace />;
  return children;
}

/** Onboarding screens: require a Supabase session but not an approved membership. */
function RequireOnboarding({ children }: { children: ReactElement }) {
  const { loading, session, isGuest, membership } = useAuth();
  if (isOnboardingPreview()) return children; // TEMP DEV PREVIEW — remove before shipping
  if (loading) return <Splash />;
  if (isGuest) return <Navigate to="/" replace />;
  if (!session) return <Navigate to="/entry" replace />;
  if (membership?.status === 'approved') return <Navigate to="/" replace />;
  return children;
}

/** Landing/auth page: send already-resolved users to where they belong. */
function EntryRoute() {
  const { loading, isAuthenticated, isGuest, membership } = useAuth();
  if (loading) return <Splash />;
  if (isGuest || (isAuthenticated && membership?.status === 'approved'))
    return <Navigate to="/" replace />;
  if (isAuthenticated && !membership) return <Navigate to="/" replace />;
  if (isAuthenticated && membership && membership.status !== 'approved')
    return <Navigate to="/pending-approval" replace />;
  return <AuthPage />;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/entry" element={<EntryRoute />} />
      <Route path="/invite/:token" element={<AcceptInvite />} />
      <Route path="/signup/details" element={<RequireNoSession><SignupDetails /></RequireNoSession>} />
      <Route path="/signup" element={<RequireOnboarding><SignupChoice /></RequireOnboarding>} />
      <Route path="/create-business" element={<RequireOnboarding><CreateBusiness /></RequireOnboarding>} />
      <Route path="/join-business" element={<RequireOnboarding><JoinBusiness /></RequireOnboarding>} />
      <Route path="/pending-approval" element={<RequireOnboarding><PendingApproval /></RequireOnboarding>} />
      <Route path="/*" element={<RequireApp><AppShell /></RequireApp>} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
