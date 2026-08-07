import { useEffect, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';
import { Mail, LogOut, Pencil, X } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../app/auth-context';
import { PageHeader } from '../common/PageHeader';
import { formatPhone } from '../../lib/phone';
import { cn } from '../../lib/utils';

const FIELD =
  'w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5';
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400';

const LANDING_OPTIONS = [
  { value: 'last', label: 'Last visited page' },
  { value: 'home', label: 'Home' },
  { value: 'schedule', label: 'Master Schedule' },
  { value: 'dailyreport', label: 'Daily Report' },
  { value: 'contacts', label: 'Driver Contacts' },
  { value: 'timeoff', label: 'Time Off' },
];

const initial = (s: string) => (s.trim()[0] ?? '?').toUpperCase();
const fmtDate = (v?: string | null) => (v ? format(new Date(v), 'MMMM d, yyyy') : '—');
const fmtDateTime = (v?: string | null) => (v ? format(new Date(v), "MMM d, yyyy 'at' h:mm a") : '—');

/**
 * "My Account" — Profile (edited via a popup) + read-only Account Information +
 * app Preferences. Reached from the user chip at the bottom of the sidebar.
 */
export function MyAccount() {
  const { session, signOut, membership, isGuest } = useAuth();
  const uid = session?.user.id;
  const businessId = membership?.businessId ?? null;

  const [loading, setLoading] = useState(true);
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [memberSince, setMemberSince] = useState<string | null>(null);
  const [stationName, setStationName] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Preferences (client-side, persisted in localStorage).
  const [landing, setLanding] = useState(() => localStorage.getItem('vt_landing') || 'home');
  const [reduceMotion, setReduceMotion] = useState(() => localStorage.getItem('vt_reduce_motion') === 'true');

  useEffect(() => {
    (async () => {
      if (!uid) {
        setLoading(false);
        return;
      }
      const [profRes, memRes, stationRes] = await Promise.all([
        supabase.from('profiles').select('full_name, email, phone').eq('id', uid).maybeSingle(),
        businessId
          ? supabase.from('business_members').select('created_at').eq('business_id', businessId).eq('user_id', uid).maybeSingle()
          : Promise.resolve({ data: null }),
        businessId
          ? supabase.from('stations').select('name').eq('business_id', businessId).eq('is_default', true).maybeSingle()
          : Promise.resolve({ data: null }),
      ]);

      const prof = profRes.data as { full_name: string | null; email: string | null; phone: string | null } | null;
      const parts = (prof?.full_name ?? '').trim().split(/\s+/).filter(Boolean);
      setFirst(parts[0] ?? '');
      setLast(parts.slice(1).join(' '));
      setPhone(prof?.phone ?? '');
      setEmail(prof?.email ?? session?.user.email ?? '');
      setMemberSince((memRes.data as { created_at?: string } | null)?.created_at ?? null);
      setStationName((stationRes.data as { name?: string } | null)?.name ?? null);
      setLoading(false);
    })();
  }, [uid, businessId]);

  // Persist the edited profile. Name + phone are immediate; an email change starts
  // Supabase's confirm-by-link flow. Updates the on-page values on success.
  const saveProfile = async (f: string, l: string, p: string, em: string) => {
    if (!uid) throw new Error('Not signed in.');
    const fullName = `${f.trim()} ${l.trim()}`.trim();
    const nextEmail = em.trim();
    const emailChanged =
      nextEmail.length > 0 && nextEmail.toLowerCase() !== (session?.user.email ?? '').toLowerCase();

    const { error: pErr } = await supabase
      .from('profiles')
      .update({
        full_name: fullName || null,
        phone: p.trim() || null,
        ...(emailChanged ? { email: nextEmail } : {}),
      })
      .eq('id', uid);
    if (pErr) throw pErr;

    if (emailChanged) {
      const { error: eErr } = await supabase.auth.updateUser({ email: nextEmail });
      if (eErr) throw eErr;
    }

    setFirst(f);
    setLast(l);
    setPhone(p);
    if (nextEmail) setEmail(nextEmail);
    if (!emailChanged) setNotice({ kind: 'ok', text: 'Your details were saved.' });
    // Let the sidebar (and anything else showing the name) refresh live.
    window.dispatchEvent(new Event('vt:profile-updated'));
    return { emailChanged };
  };

  const changeLanding = (v: string) => {
    setLanding(v);
    localStorage.setItem('vt_landing', v);
  };
  const changeReduceMotion = (v: boolean) => {
    setReduceMotion(v);
    localStorage.setItem('vt_reduce_motion', String(v));
    if (v) document.documentElement.setAttribute('data-reduce-motion', 'true');
    else document.documentElement.removeAttribute('data-reduce-motion');
  };

  const displayName = `${first} ${last}`.trim() || email || 'You';
  const role = isGuest ? 'Guest' : membership?.roleName ?? 'Member';

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="My Account">
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-gray-200 font-semibold text-gray-600 transition-all hover:bg-gray-50 hover:text-black active:scale-[0.98]"
        >
          <LogOut size={18} /> Sign out
        </button>
      </PageHeader>

      {loading ? (
        <div className="py-20 text-center text-gray-400 italic">Loading…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* ── Profile ─────────────────────────────────────────────── */}
            <Card title="Profile">
              <div className="flex gap-4">
                <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-black text-base font-bold text-white">
                  {initial(displayName)}
                </span>
                <div className="flex-1 divide-y divide-gray-50">
                  <InfoRow label="Name" value={displayName} />
                  <InfoRow label="Email" value={email || '—'} />
                  <InfoRow label="Phone" value={phone || '—'} />
                </div>
              </div>

              {notice && (
                <p className={cn('mt-4 text-sm font-medium', notice.kind === 'ok' ? 'text-green-600' : 'text-red-600')}>
                  {notice.text}
                </p>
              )}

              <button
                type="button"
                onClick={() => {
                  setNotice(null);
                  setEditing(true);
                }}
                className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl border border-gray-200 px-5 py-2.5 font-semibold text-gray-700 transition-all hover:bg-gray-50 hover:text-black active:scale-[0.98]"
              >
                <Pencil size={16} /> Edit Profile
              </button>
            </Card>

            {/* ── Account Information ──────────────────────────────────── */}
            <Card title="Account Information">
              <div className="divide-y divide-gray-50">
                <InfoRow label="Role" value={role} />
                <InfoRow label="Member Since" value={fmtDate(memberSince)} />
                <InfoRow label="Last Sign In" value={fmtDateTime(session?.user.last_sign_in_at)} />
                <InfoRow label="Assigned Station" value={stationName ?? '—'} />
              </div>
            </Card>
          </div>

          {/* ── Preferences ───────────────────────────────────────────── */}
          <div className="mt-6">
            <Card title="Preferences">
              <div className="divide-y divide-gray-50">
                <PrefRow title="Default landing page" description="The page VanTrak opens on when you sign in.">
                  <select
                    value={landing}
                    onChange={(e) => changeLanding(e.target.value)}
                    className="rounded-xl border border-gray-100 bg-gray-50/50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-black/5"
                  >
                    {LANDING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </PrefRow>

                <PrefRow title="Reduce motion" description="Minimize animations and transitions across the app.">
                  <Switch checked={reduceMotion} onChange={changeReduceMotion} />
                </PrefRow>
              </div>
            </Card>
          </div>
        </>
      )}

      {editing && (
        <EditProfileModal
          first={first}
          last={last}
          phone={phone}
          email={email}
          onSave={saveProfile}
          onClose={() => setEditing(false)}
        />
      )}
    </div>
  );
}

// ── Edit-profile popup ────────────────────────────────────────────────────────
function EditProfileModal({
  first, last, phone, email, onSave, onClose,
}: {
  first: string;
  last: string;
  phone: string;
  email: string;
  onSave: (first: string, last: string, phone: string, email: string) => Promise<{ emailChanged: boolean }>;
  onClose: () => void;
}) {
  const [f, setF] = useState(first);
  const [l, setL] = useState(last);
  const [p, setP] = useState(phone);
  const [em, setEm] = useState(email);
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirmMsg, setConfirmMsg] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    setSubmitting(true);
    try {
      const { emailChanged } = await onSave(f, l, p, em);
      if (emailChanged) {
        setConfirmMsg(
          `Saved. We sent a confirmation link to ${em.trim()} — your sign-in email changes once you click it.`,
        );
      } else {
        onClose();
      }
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Could not save your details.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-5">
          <h2 className="text-2xl font-bold tracking-tight">Edit Profile</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black">
            <X size={20} />
          </button>
        </div>

        {confirmMsg ? (
          <div className="px-8 pb-8">
            <p className="rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm font-medium text-green-700">
              {confirmMsg}
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-5 w-full rounded-xl bg-black px-6 py-3 font-bold text-white shadow-lg shadow-gray-200 transition-all hover:bg-gray-800"
            >
              Done
            </button>
          </div>
        ) : (
          <>
            <div className="space-y-4 px-8 pb-2">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>First Name</label>
                  <input value={f} onChange={(e) => setF(e.target.value)} autoFocus className={FIELD} />
                </div>
                <div className="space-y-1.5">
                  <label className={FIELD_LABEL}>Last Name</label>
                  <input value={l} onChange={(e) => setL(e.target.value)} className={FIELD} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className={FIELD_LABEL}>Email Address</label>
                <input type="email" value={em} onChange={(e) => setEm(e.target.value)} className={FIELD} />
                <p className="text-[11px] text-gray-400">
                  Changing your email sends a confirmation link — it takes effect once you click it.
                </p>
              </div>

              <div className="space-y-1.5">
                <label className={FIELD_LABEL}>Phone Number</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  maxLength={12}
                  value={p}
                  onChange={(e) => setP(formatPhone(e.target.value))}
                  className={FIELD}
                />
              </div>

              {err && <p className="text-xs font-medium text-red-600">{err}</p>}
            </div>

            <div className="flex gap-3 px-8 py-6">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 rounded-xl border border-gray-100 px-6 py-3 font-bold text-gray-500 transition-colors hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submit}
                disabled={submitting}
                className={cn(
                  'flex-1 rounded-xl bg-black px-6 py-3 font-bold text-white shadow-lg shadow-gray-200 transition-all',
                  submitting ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-800',
                )}
              >
                {submitting ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-6 py-4">
        <h2 className="text-base font-bold tracking-tight text-black">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </section>
  );
}

function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3.5 first:pt-0 last:pb-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-right text-sm font-semibold text-black">{value}</span>
    </div>
  );
}

function PrefRow({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-black">{title}</p>
        <p className="mt-0.5 text-xs text-gray-400">{description}</p>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Switch({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', checked ? 'bg-black' : 'bg-gray-200')}
    >
      <span
        className={cn(
          'absolute left-0.5 top-0.5 size-5 rounded-full bg-white shadow transition-transform',
          checked && 'translate-x-5',
        )}
      />
    </button>
  );
}
