import { useCallback, useEffect, useState } from 'react';
import { motion } from 'motion/react';
import {
  Mail, Copy, Check, Trash2, UserCheck, ShieldAlert, Plus, Pencil, X,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendAppEmail, emailTemplate } from '../../lib/email';
import { useAuth } from '../../app/auth-context';
import { PERMISSION_SECTIONS, ROLE_TEMPLATES, permissionGranted } from '../../lib/permissions';
import { PageHeader } from '../common/PageHeader';
import { cn } from '../../lib/utils';

interface MemberRow {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  roleName: string | null;
  permissions: string[];
  fullName: string | null;
  email: string | null;
  phone: string | null;
}
interface InviteRow {
  id: string;
  email: string;
  token: string;
  roleName: string | null;
}
interface ModalState {
  mode: 'invite' | 'edit';
  member?: MemberRow;
}

const initials = (name: string) => (name.trim()[0] ?? '?').toUpperCase();

// Matches the driver "Add New Driver" primary button.
const PRIMARY_BTN =
  'flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-xl font-semibold hover:bg-gray-800 transition-all shadow-lg shadow-gray-200 active:scale-[0.98]';
const FIELD =
  'w-full px-4 py-2.5 rounded-xl border border-gray-100 bg-gray-50/50 focus:outline-none focus:ring-2 focus:ring-black/5';
const FIELD_LABEL = 'text-[10px] font-bold uppercase tracking-widest text-gray-400';

export function TeamManagement() {
  const { membership, session, hasPermission } = useAuth();
  const businessId = membership?.businessId ?? null;
  const myUserId = session?.user.id;

  const canInvite = hasPermission('admin.invite');
  const canEditPerms = hasPermission('admin.permissions.edit');
  const canRemove = hasPermission('admin.users.remove');
  const canAccess = canInvite || canEditPerms || canRemove;

  const [businessName, setBusinessName] = useState('');
  const [members, setMembers] = useState<MemberRow[]>([]);
  const [invites, setInvites] = useState<InviteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const [modal, setModal] = useState<ModalState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [removing, setRemoving] = useState<MemberRow | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    const [biz, memberRes, inviteRes] = await Promise.all([
      supabase.from('businesses').select('name').eq('id', businessId).maybeSingle(),
      supabase
        .from('business_members')
        .select('id, user_id, status, role_name, permissions')
        .eq('business_id', businessId)
        .order('created_at'),
      supabase
        .from('invites')
        .select('id, email, token, role_name')
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    // Profiles are fetched separately (no FK business_members.user_id -> profiles,
    // so PostgREST can't embed them). RLS returns own + managed profiles.
    const memberRows = (memberRes.data ?? []) as Record<string, unknown>[];
    const userIds = memberRows.map((m) => m.user_id as string);
    const { data: profs } = userIds.length
      ? await supabase.from('profiles').select('id, full_name, email, phone').in('id', userIds)
      : { data: [] as any[] };
    const profById = new Map<string, { full_name: string | null; email: string | null; phone: string | null }>(
      (profs ?? []).map((p: any) => [p.id, p]),
    );

    setBusinessName(biz.data?.name ?? '');
    setMembers(
      memberRows.map((m) => {
        const p = profById.get(m.user_id as string);
        return {
          id: m.id as string,
          userId: m.user_id as string,
          status: m.status as MemberRow['status'],
          roleName: (m.role_name as string | null) ?? null,
          permissions: (m.permissions as string[] | null) ?? [],
          fullName: p?.full_name ?? null,
          email: p?.email ?? null,
          phone: p?.phone ?? null,
        };
      })
    );
    setInvites(
      (inviteRes.data ?? []).map((i: Record<string, unknown>) => ({
        id: i.id as string,
        email: i.email as string,
        token: i.token as string,
        roleName: (i.role_name as string | null) ?? null,
      }))
    );
    setLoading(false);
  }, [businessId]);

  useEffect(() => {
    load();
  }, [load]);

  const submitModal = async (email: string, roleName: string, permissions: string[]) => {
    if (!modal) return;
    setSubmitting(true);
    setNotice(null);
    try {
      if (modal.mode === 'invite') {
        const clean = email.trim().toLowerCase();
        const { data, error } = await supabase.rpc('create_invite', {
          p_business_id: businessId,
          p_email: clean,
          p_role_name: roleName,
          p_permissions: permissions,
        });
        if (error) throw error;
        const token = (data as { token: string }).token;
        const link = `${window.location.origin}/invite/${token}`;
        try {
          await sendAppEmail({
            to: clean,
            subject: `You're invited to join ${businessName} on VanTrak`,
            html: emailTemplate({
              heading: `You're invited to ${businessName}`,
              body: `You've been invited to join <strong>${businessName}</strong> as <strong>${roleName}</strong> on VanTrak. Click below to accept and set up your account.<br><br>Or paste this link into your browser:<br><span style="color:#6b7280;font-size:12px;word-break:break-all">${link}</span>`,
              cta: { label: 'Accept invite', url: link },
            }),
          });
          setNotice({ kind: 'ok', text: `Invite emailed to ${clean}.` });
        } catch (mailErr) {
          const detail = mailErr instanceof Error ? mailErr.message : '';
          setNotice({
            kind: 'err',
            text: `Invite created, but the email failed${detail ? `: ${detail}` : ''}. Copy the link from the table to share it.`,
          });
        }
      } else if (modal.member) {
        await supabase
          .from('business_members')
          .update({ role_name: roleName || null, permissions })
          .eq('id', modal.member.id);
        setNotice({ kind: 'ok', text: 'Permissions updated.' });
      }
      setModal(null);
      await load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Something went wrong.' });
    } finally {
      setSubmitting(false);
    }
  };

  const approveMember = async (id: string) => {
    await supabase.from('business_members').update({ status: 'approved' }).eq('id', id);
    load();
  };
  const removeMember = async (m: MemberRow) => {
    setRemovingBusy(true);
    // `.select()` so we can tell a real removal from an RLS no-op (0 rows).
    const { data, error } = await supabase
      .from('business_members')
      .delete()
      .eq('id', m.id)
      .select('id');
    setRemovingBusy(false);
    if (error) {
      setNotice({ kind: 'err', text: error.message });
      return;
    }
    if (!data || data.length === 0) {
      setNotice({ kind: 'err', text: "Couldn't remove this member — you may not have permission." });
      return;
    }
    setRemoving(null);
    setNotice({ kind: 'ok', text: `${m.fullName || m.email || 'Member'} was removed from the team.` });
    await load();
  };
  const revokeInvite = async (id: string) => {
    // Emails can't be recalled, but revoking invalidates the invite token so the
    // link in that email stops working (the recipient sees "Invite unavailable").
    const { error } = await supabase.rpc('revoke_invite', { p_id: id });
    if (error) {
      setNotice({ kind: 'err', text: error.message });
      return;
    }
    setNotice({ kind: 'ok', text: 'Invite deleted — its link no longer works.' });
    load();
  };
  const copyLink = (token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
  };

  if (!businessId) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <EmptyNotice icon={<ShieldAlert size={22} />} title="No business yet" body="User management is available once you're part of a business." />
      </div>
    );
  }
  if (!canAccess) {
    return (
      <div className="p-8 max-w-[1600px] mx-auto">
        <EmptyNotice icon={<ShieldAlert size={22} />} title="You don't have access" body="Managing users requires the Invite, Edit Permissions, or Remove Users permission." />
      </div>
    );
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <PageHeader title="Team">
        {canInvite && (
          <button type="button" onClick={() => setModal({ mode: 'invite' })} className={PRIMARY_BTN}>
            <Plus size={20} />
            Add User
          </button>
        )}
      </PageHeader>

      {notice && (
        <p className={cn('mb-6 text-sm font-medium', notice.kind === 'ok' ? 'text-green-600' : 'text-red-600')}>
          {notice.text}
        </p>
      )}

      {/* ── Team members ────────────────────────────────────────────────── */}
      <h2 className="mb-3 text-[11px] font-bold uppercase tracking-widest text-gray-400">Members</h2>
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Email</th>
              <th className="px-6 py-4">Role</th>
              <th className="px-6 py-4">Status</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {members.map((m) => {
              const isSelf = m.userId === myUserId;
              const isOwner = m.permissions.includes('*');
              const name = m.fullName || m.email || 'Unknown';
              return (
                <tr key={m.id} className="hover:bg-gray-50/30 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black text-xs font-bold text-white">
                        {initials(name)}
                      </span>
                      <span className="font-bold text-black">
                        {name} {isSelf && <span className="text-[11px] font-medium text-gray-400">(you)</span>}
                      </span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-medium text-gray-500">{m.email ?? '—'}</td>
                  <td className="px-6 py-4 text-sm font-medium text-gray-600">{m.roleName ?? '—'}</td>
                  <td className="px-6 py-4">
                    <StatusPill status={m.status === 'pending' ? 'Pending' : 'Active'} />
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center justify-end gap-1">
                      {canEditPerms && !isSelf && !isOwner && (
                        <IconBtn onClick={() => setModal({ mode: 'edit', member: m })} title="Edit permissions">
                          <Pencil size={16} />
                        </IconBtn>
                      )}
                      {canEditPerms && !isSelf && m.status === 'pending' && (
                        <IconBtn onClick={() => approveMember(m.id)} title="Approve" tone="emerald">
                          <UserCheck size={16} />
                        </IconBtn>
                      )}
                      {canRemove && !isSelf && !isOwner && (
                        <IconBtn onClick={() => setRemoving(m)} title="Remove member" danger>
                          <Trash2 size={16} />
                        </IconBtn>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {!loading && members.length === 0 && (
          <div className="py-20 text-center text-gray-400 italic">No members yet.</div>
        )}
        {loading && <div className="py-20 text-center text-gray-400 italic">Loading…</div>}
      </div>

      {/* ── Pending invites ─────────────────────────────────────────────── */}
      {canInvite && (
        <div className="mt-8">
          <div className="mb-3 flex items-center gap-2">
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-gray-400">Pending Invites</h2>
            {invites.length > 0 && (
              <span className="rounded-full bg-orange-100 px-2 py-0.5 text-[10px] font-bold text-orange-700">
                {invites.length}
              </span>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
            {invites.length === 0 ? (
              <div className="flex flex-col items-center gap-1 py-14 text-center">
                <Mail className="mb-1 text-gray-300" size={22} />
                <p className="text-sm font-medium text-gray-500">No pending invites</p>
                <p className="text-xs text-gray-400">
                  Invites you send appear here until they're accepted.
                </p>
              </div>
            ) : (
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-gray-50/50 text-[11px] uppercase tracking-widest font-bold text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4">Role</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {invites.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/30 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-orange-50 text-orange-400">
                            <Mail size={15} />
                          </span>
                          <span className="font-bold text-black">{inv.email}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm font-medium text-gray-600">{inv.roleName ?? '—'}</td>
                      <td className="px-6 py-4"><StatusPill status="Pending" /></td>
                      <td className="px-6 py-4">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => copyLink(inv.token)}
                            className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-black active:scale-[0.97]"
                          >
                            {copied === inv.token ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                            {copied === inv.token ? 'Copied' : 'Link'}
                          </button>
                          <IconBtn onClick={() => revokeInvite(inv.id)} title="Delete invite" danger>
                            <Trash2 size={16} />
                          </IconBtn>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {modal && (
        <UserModal
          key={modal.member?.id ?? 'invite'}
          mode={modal.mode}
          member={modal.member}
          submitting={submitting}
          onSubmit={submitModal}
          onClose={() => setModal(null)}
        />
      )}

      {removing && (
        <ConfirmRemoveModal
          member={removing}
          businessName={businessName}
          busy={removingBusy}
          onConfirm={() => removeMember(removing)}
          onClose={() => setRemoving(null)}
        />
      )}
    </div>
  );
}

// ── Confirm removing a member ─────────────────────────────────────────────────
function ConfirmRemoveModal({
  member, businessName, busy, onConfirm, onClose,
}: {
  member: MemberRow;
  businessName: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const who = member.fullName || member.email || 'This member';
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={onClose} className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white p-8 shadow-2xl"
      >
        <span className="mb-4 flex size-12 items-center justify-center rounded-full bg-red-50 text-red-500">
          <Trash2 size={22} />
        </span>
        <h2 className="text-xl font-bold tracking-tight">Remove member?</h2>
        <p className="mt-2 text-sm leading-relaxed text-gray-500">
          <span className="font-semibold text-black">{who}</span> will lose access to{' '}
          <span className="font-semibold text-black">{businessName || 'this business'}</span> immediately.
          Their account isn&apos;t deleted, and you can re-invite them later.
        </p>
        <div className="mt-6 flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={cn(
              'flex-1 px-6 py-3 rounded-xl bg-red-500 text-white font-bold transition-all shadow-lg shadow-red-100',
              busy ? 'opacity-50 cursor-not-allowed' : 'hover:bg-red-600',
            )}
          >
            {busy ? 'Removing…' : 'Remove'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

// ── Invite / Add user (and edit) modal ───────────────────────────────────────
function UserModal({
  mode, member, submitting, onSubmit, onClose,
}: {
  mode: 'invite' | 'edit';
  member?: MemberRow;
  submitting: boolean;
  onSubmit: (email: string, roleName: string, permissions: string[]) => void;
  onClose: () => void;
}) {
  const [email, setEmail] = useState(member?.email ?? '');
  const [template, setTemplate] = useState(member?.roleName ?? ROLE_TEMPLATES[0]?.name ?? 'Viewer');
  const [perms, setPerms] = useState<string[]>(
    member ? [...member.permissions] : [...(ROLE_TEMPLATES.find((t) => t.name === (member?.roleName ?? ROLE_TEMPLATES[0]?.name))?.permissions ?? [])]
  );

  const pickTemplate = (name: string) => {
    setTemplate(name);
    setPerms([...(ROLE_TEMPLATES.find((t) => t.name === name)?.permissions ?? [])]);
  };

  const customRole =
    member?.roleName && !ROLE_TEMPLATES.some((t) => t.name === member.roleName) ? member.roleName : null;
  const canSubmit = mode === 'edit' || email.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
        className="relative flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between px-8 pt-8 pb-5">
          <h2 className="text-2xl font-bold tracking-tight">
            {mode === 'invite' ? 'Add New User' : `Edit ${member?.fullName || member?.email || 'User'}`}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-gray-100 hover:text-black">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-8 pb-2">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Email Address</label>
              {mode === 'invite' ? (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@company.com"
                  autoFocus
                  className={FIELD}
                />
              ) : (
                <div className={cn(FIELD, 'text-gray-500')}>{member?.email}</div>
              )}
            </div>
            <div className="space-y-1.5">
              <label className={FIELD_LABEL}>Role Template</label>
              <select value={template} onChange={(e) => pickTemplate(e.target.value)} className={FIELD}>
                {customRole && <option value={customRole}>{customRole}</option>}
                {ROLE_TEMPLATES.map((t) => (
                  <option key={t.name} value={t.name}>{t.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <label className={FIELD_LABEL}>Permissions ({perms.length})</label>
            <PermissionEditor value={perms} onChange={setPerms} />
          </div>
        </div>

        <div className="flex gap-3 px-8 py-6">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-6 py-3 rounded-xl border border-gray-100 font-bold text-gray-500 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => onSubmit(email, template, perms)}
            disabled={submitting || !canSubmit}
            className={cn(
              'flex-1 px-6 py-3 rounded-xl bg-black text-white font-bold transition-all shadow-lg shadow-gray-200',
              submitting || !canSubmit ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-800'
            )}
          >
            {submitting ? 'Saving…' : mode === 'invite' ? 'Send Invite' : 'Save Changes'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PermissionEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="space-y-4 rounded-2xl border border-gray-100 bg-gray-50/50 p-4">
      {PERMISSION_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-400">{section.title}</p>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {section.permissions.map((p) => {
              const checked = value.includes(p.key);
              const implied = !checked && permissionGranted(value, p.key);
              return (
                <label key={p.key} className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm font-medium text-gray-700 transition-colors hover:bg-white">
                  <input
                    type="checkbox"
                    checked={checked || implied}
                    disabled={implied}
                    onChange={() => toggle(p.key)}
                    className="size-4 rounded accent-black"
                  />
                  <span className={cn(implied && 'text-gray-400')}>{p.label}</span>
                </label>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function StatusPill({ status }: { status: 'Active' | 'Pending' | 'Invited' }) {
  const styles: Record<string, string> = {
    Active: 'bg-green-50 text-green-700 border-green-200',
    Pending: 'bg-orange-100 text-orange-700 border-orange-200',
    Invited: 'bg-blue-50 text-blue-600 border-blue-200',
  };
  return (
    <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-bold border uppercase tracking-tighter', styles[status])}>
      {status}
    </span>
  );
}

function IconBtn({
  onClick, title, children, danger, tone,
}: {
  onClick: () => void; title: string; children: React.ReactNode; danger?: boolean; tone?: 'emerald';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg p-2 text-gray-400 transition-colors active:scale-[0.97]',
        danger && 'hover:bg-red-50 hover:text-red-600',
        tone === 'emerald' && 'hover:bg-green-50 hover:text-green-600',
        !danger && !tone && 'hover:bg-gray-100 hover:text-black'
      )}
    >
      {children}
    </button>
  );
}

function EmptyNotice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto mt-24 max-w-sm rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">{icon}</span>
      <h2 className="text-base font-bold text-black">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </div>
  );
}
