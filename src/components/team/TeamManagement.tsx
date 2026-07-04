import { useCallback, useEffect, useState } from 'react';
import { Mail, Copy, Check, Trash2, UserCheck, ShieldAlert, Send, ChevronDown, Pencil } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { sendAppEmail } from '../../lib/email';
import { useAuth } from '../../app/auth-context';
import { PERMISSION_SECTIONS, ROLE_TEMPLATES, permissionGranted } from '../../lib/permissions';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { cn } from '../../lib/utils';

interface MemberRow {
  id: string;
  userId: string;
  status: 'pending' | 'approved' | 'rejected';
  roleName: string | null;
  permissions: string[];
  fullName: string | null;
  email: string | null;
}
interface InviteRow {
  id: string;
  email: string;
  token: string;
  roleName: string | null;
}

const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v ?? null);
const selectCls =
  'h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-black outline-none transition-colors focus-visible:border-black';

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

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteTemplate, setInviteTemplate] = useState('Dispatcher');
  const [invitePerms, setInvitePerms] = useState<string[]>(
    () => ROLE_TEMPLATES.find((t) => t.name === 'Dispatcher')?.permissions ?? []
  );
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  // Inline member editor
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPerms, setEditPerms] = useState<string[]>([]);
  const [editRoleName, setEditRoleName] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) {
      setLoading(false);
      return;
    }
    const [biz, memberRes, inviteRes] = await Promise.all([
      supabase.from('businesses').select('name').eq('id', businessId).maybeSingle(),
      supabase
        .from('business_members')
        .select('id, user_id, status, role_name, permissions, profiles:user_id ( full_name, email )')
        .eq('business_id', businessId)
        .order('created_at'),
      supabase
        .from('invites')
        .select('id, email, token, role_name')
        .eq('business_id', businessId)
        .eq('status', 'pending')
        .order('created_at', { ascending: false }),
    ]);

    setBusinessName(biz.data?.name ?? '');
    setMembers(
      (memberRes.data ?? []).map((m: Record<string, unknown>) => {
        const p = one(m.profiles as { full_name: string | null; email: string | null } | null);
        return {
          id: m.id as string,
          userId: m.user_id as string,
          status: m.status as MemberRow['status'],
          roleName: (m.role_name as string | null) ?? null,
          permissions: (m.permissions as string[] | null) ?? [],
          fullName: p?.full_name ?? null,
          email: p?.email ?? null,
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

  const pickTemplate = (name: string) => {
    setInviteTemplate(name);
    setInvitePerms([...(ROLE_TEMPLATES.find((t) => t.name === name)?.permissions ?? [])]);
  };

  const sendInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setNotice(null);
    setSending(true);
    try {
      const { data, error } = await supabase.rpc('create_invite', {
        p_business_id: businessId,
        p_email: email,
        p_role_name: inviteTemplate,
        p_permissions: invitePerms,
      });
      if (error) throw error;
      const token = (data as { token: string }).token;
      const link = `${window.location.origin}/invite/${token}`;
      try {
        await sendAppEmail({
          to: email,
          subject: `You're invited to join ${businessName} on VanTrak`,
          html: `<p>You've been invited to join <strong>${businessName}</strong> as <strong>${inviteTemplate}</strong>.</p>
                 <p><a href="${link}">Accept your invite</a></p>
                 <p>Or paste this link into your browser:<br>${link}</p>`,
        });
        setNotice({ kind: 'ok', text: `Invite emailed to ${email}.` });
      } catch {
        setNotice({ kind: 'err', text: 'Invite created, but the email failed to send. Copy the link from the list below.' });
      }
      setInviteEmail('');
      await load();
    } catch (err) {
      setNotice({ kind: 'err', text: err instanceof Error ? err.message : 'Could not create the invite.' });
    } finally {
      setSending(false);
    }
  };

  const startEdit = (m: MemberRow) => {
    setEditingId(m.id);
    setEditRoleName(m.roleName ?? '');
    setEditPerms([...m.permissions]);
  };
  const saveEdit = async (memberId: string) => {
    setSavingEdit(true);
    await supabase
      .from('business_members')
      .update({ role_name: editRoleName || null, permissions: editPerms })
      .eq('id', memberId);
    setSavingEdit(false);
    setEditingId(null);
    load();
  };
  const approveMember = async (memberId: string) => {
    await supabase.from('business_members').update({ status: 'approved' }).eq('id', memberId);
    load();
  };
  const removeMember = async (memberId: string) => {
    await supabase.from('business_members').delete().eq('id', memberId);
    load();
  };
  const revokeInvite = async (id: string) => {
    await supabase.rpc('revoke_invite', { p_id: id });
    load();
  };
  const copyLink = (token: string) => {
    navigator.clipboard?.writeText(`${window.location.origin}/invite/${token}`);
    setCopied(token);
    setTimeout(() => setCopied((c) => (c === token ? null : c)), 1500);
  };

  if (!businessId) {
    return (
      <Wrap>
        <EmptyNotice
          icon={<ShieldAlert className="size-6" />}
          title="No business yet"
          body="Team management is available once you're part of a business."
        />
      </Wrap>
    );
  }
  if (!canAccess) {
    return (
      <Wrap>
        <EmptyNotice
          icon={<ShieldAlert className="size-6" />}
          title="You don't have access"
          body="Managing the team requires the Invite, Edit Permissions, or Remove Users permission."
        />
      </Wrap>
    );
  }

  return (
    <Wrap>
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-black">Team &amp; Access</h1>
        <p className="mt-1 text-sm text-gray-500">
          Manage who can access {businessName || 'your business'} and exactly what they can do.
        </p>
      </header>

      {canInvite && (
        <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-black">Invite someone</h2>
          <div className="flex flex-col gap-2.5 sm:flex-row">
            <Input
              type="email"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              placeholder="name@company.com"
              disabled={sending}
              className="h-11 flex-1 rounded-xl"
            />
            <select value={inviteTemplate} onChange={(e) => pickTemplate(e.target.value)} disabled={sending} className={cn(selectCls, 'sm:w-40')}>
              {ROLE_TEMPLATES.map((t) => (
                <option key={t.name} value={t.name}>
                  {t.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              size="lg"
              onClick={sendInvite}
              disabled={sending || !inviteEmail.trim()}
              className="h-11 gap-2 rounded-xl transition-transform active:scale-[0.97]"
            >
              <Send className="size-4" />
              {sending ? 'Sending…' : 'Send invite'}
            </Button>
          </div>

          <button
            type="button"
            onClick={() => setCustomizeOpen((o) => !o)}
            className="mt-3 flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-black"
          >
            <ChevronDown className={cn('size-4 transition-transform duration-200', customizeOpen && 'rotate-180')} />
            Customize permissions ({invitePerms.length} selected)
          </button>
          {customizeOpen && (
            <div className="mt-3 border-t border-gray-100 pt-4">
              <PermissionEditor value={invitePerms} onChange={setInvitePerms} />
            </div>
          )}

          {notice && (
            <p className={cn('mt-3 text-xs', notice.kind === 'ok' ? 'text-emerald-600' : 'text-red-600')}>{notice.text}</p>
          )}
        </section>
      )}

      {invites.length > 0 && (
        <section className="mb-8">
          <SectionLabel>Pending invites</SectionLabel>
          <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            {invites.map((inv) => (
              <div key={inv.id} className="flex items-center gap-3 px-4 py-3">
                <IconCircle className="bg-amber-50 text-amber-500">
                  <Mail className="size-4" />
                </IconCircle>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-black">{inv.email}</p>
                  <p className="text-xs text-gray-400">Invited as {inv.roleName ?? 'member'} · awaiting sign-up</p>
                </div>
                <button
                  type="button"
                  onClick={() => copyLink(inv.token)}
                  className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs text-gray-500 transition-colors hover:bg-gray-50 hover:text-black active:scale-[0.97]"
                >
                  {copied === inv.token ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
                  {copied === inv.token ? 'Copied' : 'Link'}
                </button>
                {canInvite && (
                  <IconButton onClick={() => revokeInvite(inv.id)} title="Revoke invite" danger>
                    <Trash2 className="size-4" />
                  </IconButton>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <SectionLabel>Members {!loading && `(${members.length})`}</SectionLabel>
        <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {loading ? (
            <div className="px-4 py-8 text-center text-sm text-gray-400">Loading…</div>
          ) : (
            members.map((m) => {
              const isSelf = m.userId === myUserId;
              const isOwner = m.permissions.includes('*');
              const name = m.fullName || m.email || 'Unknown';
              const editable = canEditPerms && !isSelf && !isOwner;
              return (
                <div key={m.id}>
                  <div className="flex items-center gap-3 px-4 py-3">
                    <IconCircle className="bg-black text-xs font-semibold text-white">
                      {(name[0] ?? '?').toUpperCase()}
                    </IconCircle>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-black">
                        {name} {isSelf && <span className="text-xs font-normal text-gray-400">(you)</span>}
                      </p>
                      <p className="truncate text-xs text-gray-400">{m.email}</p>
                    </div>

                    {m.status === 'pending' && <Pill>Pending</Pill>}
                    <span className="text-sm text-gray-500">{m.roleName ?? '—'}</span>

                    {editable && (
                      <IconButton onClick={() => (editingId === m.id ? setEditingId(null) : startEdit(m))} title="Edit permissions">
                        <Pencil className="size-4" />
                      </IconButton>
                    )}
                    {canEditPerms && !isSelf && m.status === 'pending' && (
                      <IconButton onClick={() => approveMember(m.id)} title="Approve" tone="emerald">
                        <UserCheck className="size-4" />
                      </IconButton>
                    )}
                    {canRemove && !isSelf && !isOwner && (
                      <IconButton onClick={() => removeMember(m.id)} title="Remove from business" danger>
                        <Trash2 className="size-4" />
                      </IconButton>
                    )}
                  </div>

                  {editingId === m.id && editable && (
                    <div className="border-t border-gray-100 bg-gray-50/60 px-4 py-4">
                      <div className="mb-3 flex items-center gap-2">
                        <span className="text-xs font-medium text-gray-500">Role label</span>
                        <select value={editRoleName} onChange={(e) => setEditRoleName(e.target.value)} className={cn(selectCls, 'h-9')}>
                          {editRoleName && !ROLE_TEMPLATES.some((t) => t.name === editRoleName) && (
                            <option value={editRoleName}>{editRoleName}</option>
                          )}
                          {ROLE_TEMPLATES.map((t) => (
                            <option key={t.name} value={t.name}>
                              {t.name}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          onClick={() => setEditPerms([...(ROLE_TEMPLATES.find((t) => t.name === editRoleName)?.permissions ?? editPerms)])}
                          className="text-xs text-gray-500 underline underline-offset-2 hover:text-black"
                        >
                          Reset to template
                        </button>
                      </div>
                      <PermissionEditor value={editPerms} onChange={setEditPerms} />
                      <div className="mt-4 flex gap-2">
                        <Button size="sm" onClick={() => saveEdit(m.id)} disabled={savingEdit} className="rounded-lg active:scale-[0.97]">
                          {savingEdit ? 'Saving…' : 'Save changes'}
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => setEditingId(null)} className="rounded-lg">
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </section>
    </Wrap>
  );
}

function PermissionEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const toggle = (key: string) =>
    onChange(value.includes(key) ? value.filter((k) => k !== key) : [...value, key]);

  return (
    <div className="space-y-4">
      {PERMISSION_SECTIONS.map((section) => (
        <div key={section.title}>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">{section.title}</p>
          <div className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
            {section.permissions.map((p) => {
              const checked = value.includes(p.key);
              // Show `.view` as implicitly on when the matching `.edit` is granted.
              const implied = !checked && permissionGranted(value, p.key);
              return (
                <label
                  key={p.key}
                  className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm text-gray-700 transition-colors hover:bg-white"
                >
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

function Wrap({ children }: { children: React.ReactNode }) {
  return <div className="mx-auto max-w-3xl px-8 py-10">{children}</div>;
}
function SectionLabel({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 px-1 text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</h2>;
}
function Pill({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600">{children}</span>;
}
function IconCircle({ className, children }: { className?: string; children: React.ReactNode }) {
  return <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', className)}>{children}</span>;
}
function IconButton({
  onClick,
  title,
  children,
  danger,
  tone,
}: {
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  danger?: boolean;
  tone?: 'emerald';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={cn(
        'rounded-lg p-1.5 text-gray-400 transition-colors active:scale-[0.97]',
        danger && 'hover:bg-red-50 hover:text-red-600',
        tone === 'emerald' && 'hover:bg-emerald-50 hover:text-emerald-600',
        !danger && !tone && 'hover:bg-gray-100 hover:text-black'
      )}
    >
      {children}
    </button>
  );
}
function EmptyNotice({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="mx-auto mt-20 max-w-sm rounded-2xl border border-gray-100 bg-white p-8 text-center shadow-sm">
      <span className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-gray-50 text-gray-400">{icon}</span>
      <h2 className="text-base font-semibold text-black">{title}</h2>
      <p className="mt-1 text-sm text-gray-500">{body}</p>
    </div>
  );
}
