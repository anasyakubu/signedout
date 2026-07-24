import { FormEvent, useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { CeremonyData, GroupData, PaymentRequiredInfo } from '../lib/types';
import { Wordmark, Button, Field, FormError } from '../components/ui';
import CheckoutPanel from '../features/payments/CheckoutPanel';

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>();
  const [group, setGroup] = useState<GroupData | null>(null);
  const [ceremonies, setCeremonies] = useState<CeremonyData[]>([]);
  const [myRole, setMyRole] = useState<'owner' | 'editor' | 'member' | null>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [gate, setGate] = useState<PaymentRequiredInfo | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const d = await api<{ group: GroupData; ceremonies: CeremonyData[]; myRole: typeof myRole }>(
        `/api/groups/${id}`
      );
      setGroup(d.group);
      setCeremonies(d.ceremonies);
      setMyRole(d.myRole);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load this group.');
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  if (error && !group) {
    return (
      <Shell>
        <FormError message={error} />
      </Shell>
    );
  }
  if (!group) {
    return (
      <Shell>
        <p className="text-stone">Loading the group</p>
      </Shell>
    );
  }

  const joinUrl = `${window.location.origin}/join/${group.joinCode}`;
  const canManage = myRole === 'owner' || myRole === 'editor';

  async function copyJoin() {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function invite(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);
    setGate(null);
    try {
      await api(`/api/groups/${id}/invite`, {
        method: 'POST',
        body: JSON.stringify({ email: inviteEmail }),
      });
      setNotice('Added to the group.');
      setInviteEmail('');
      await load();
    } catch (err) {
      if (err instanceof ApiError && err.status === 402 && err.body?.paymentRequired) {
        setGate(err.body.paymentRequired as PaymentRequiredInfo);
      } else {
        setError(err instanceof ApiError ? err.message : 'The invite failed.');
      }
    }
  }

  async function setRole(userId: string, role: 'editor' | 'member') {
    try {
      await api(`/api/groups/${id}/members/${userId}`, {
        method: 'PATCH',
        body: JSON.stringify({ role }),
      });
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The role change failed.');
    }
  }

  return (
    <Shell>
      <h1 className="font-display text-3xl text-ink">{group.name}</h1>
      <p className="mt-1 text-sm text-stone">
        {group.members.length} {group.members.length === 1 ? 'member' : 'members'}
        {group.upgraded ? ' — member cap upgraded' : ''}
      </p>
      <span className="signature-line mt-3" />

      <FormError message={error} />
      {notice && <p className="mt-4 border border-laurel bg-laurel-pale p-3 text-sm text-laurel-dark">{notice}</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-2">
        <section className="border border-line bg-white p-5">
          <h2 className="font-display text-lg text-ink">Join link</h2>
          <p className="mt-2 text-sm text-stone">
            Classmates with a SignedOut account join instantly with this link.
          </p>
          <div className="mt-3 flex gap-2">
            <input
              readOnly
              value={joinUrl}
              onFocus={(e) => e.target.select()}
              className="w-full border border-line bg-paper px-3 py-2 text-sm"
            />
            <Button type="button" onClick={copyJoin}>
              {copied ? 'Copied' : 'Copy'}
            </Button>
          </div>

          {canManage && (
            <form onSubmit={invite} className="mt-5 border-t border-line pt-4">
              <Field
                label="Or add by email (existing accounts)"
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="classmate@school.edu"
                required
              />
              <div className="mt-3">
                <Button type="submit">Add member</Button>
              </div>
            </form>
          )}

          {gate && (
            <div className="mt-4">
              <CheckoutPanel
                info={gate}
                groupId={group._id}
                heading="Raise the member cap"
                onFreeSuccess={() => {
                  setGate(null);
                  load();
                }}
                onCancel={() => setGate(null)}
              />
            </div>
          )}
        </section>

        <section className="border border-line bg-white p-5">
          <h2 className="font-display text-lg text-ink">Members</h2>
          <ul className="mt-3 divide-y divide-line">
            {group.members.map((m) => {
              const u = typeof m.userId === 'string' ? null : m.userId;
              const uid = typeof m.userId === 'string' ? m.userId : m.userId._id;
              return (
                <li key={uid} className="flex items-center justify-between gap-3 py-2.5">
                  <div>
                    <p className="text-sm font-semibold text-ink">{u?.name ?? 'Member'}</p>
                    <p className="text-xs text-stone">{u?.email ?? ''} — {m.role}</p>
                  </div>
                  {myRole === 'owner' && m.role !== 'owner' && (
                    <button
                      onClick={() => setRole(uid, m.role === 'editor' ? 'member' : 'editor')}
                      className="text-sm font-semibold text-laurel hover:underline"
                    >
                      {m.role === 'editor' ? 'Make member' : 'Make editor'}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      </div>

      <section className="mt-8">
        <div className="flex items-end justify-between">
          <h2 className="font-display text-xl text-ink">Group ceremonies</h2>
          {canManage && (
            <Link to={`/ceremonies/new?groupId=${group._id}`}>
              <Button>New ceremony</Button>
            </Link>
          )}
        </div>
        {ceremonies.length === 0 ? (
          <p className="mt-4 text-stone">No ceremonies in this group yet.</p>
        ) : (
          <ul className="mt-4 divide-y divide-line border border-line bg-white">
            {ceremonies.map((c) => (
              <li key={c._id}>
                <Link
                  to={`/ceremonies/${c._id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-laurel-pale/40"
                >
                  <div className="flex items-center gap-4">
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0 border border-line"
                      style={{ backgroundColor: c.shirtColor }}
                    />
                    <p className="font-semibold text-ink">{c.title}</p>
                  </div>
                  <span className="text-sm font-semibold text-laurel">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Wordmark to="/dashboard" />
        <Link to="/groups" className="text-sm font-semibold text-ink hover:text-laurel">
          All groups
        </Link>
      </header>
      <main className="mx-auto max-w-4xl px-6 pb-24 pt-4">{children}</main>
    </div>
  );
}
