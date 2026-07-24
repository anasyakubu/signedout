import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { GroupData } from '../lib/types';
import { Wordmark, Button, Field, FormError } from '../components/ui';

export default function Groups() {
  const [groups, setGroups] = useState<GroupData[] | null>(null);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const d = await api<{ groups: GroupData[] }>('/api/groups');
      setGroups(d.groups);
    } catch {
      setGroups([]);
    }
  }
  useEffect(() => {
    load();
  }, []);

  async function create(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api('/api/groups', { method: 'POST', body: JSON.stringify({ name }) });
      setName('');
      await load();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'The group could not be created.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark to="/dashboard" />
        <Link to="/dashboard" className="text-sm font-semibold text-ink hover:text-laurel">
          Dashboard
        </Link>
      </header>
      <main className="mx-auto max-w-3xl px-6 pb-24 pt-8">
        <h1 className="font-display text-3xl text-ink">Groups</h1>
        <p className="mt-2 max-w-lg text-[15px] text-stone">
          A group is your class or department: shared ceremonies, co-editors, one join link for
          everyone.
        </p>
        <span className="signature-line mt-4" />

        <form onSubmit={create} className="mt-8 flex items-end gap-3">
          <div className="flex-1">
            <Field
              label="New group name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Computing Science 2026"
              required
              minLength={2}
            />
          </div>
          <Button type="submit" disabled={busy}>
            {busy ? 'Creating' : 'Create group'}
          </Button>
        </form>
        <FormError message={error} />

        {groups === null ? (
          <p className="mt-8 text-stone">Loading groups</p>
        ) : groups.length === 0 ? (
          <p className="mt-8 text-stone">You are not in any groups yet.</p>
        ) : (
          <ul className="mt-8 divide-y divide-line border border-line bg-white">
            {groups.map((g) => (
              <li key={g._id}>
                <Link
                  to={`/groups/${g._id}`}
                  className="flex items-center justify-between px-5 py-4 hover:bg-laurel-pale/40"
                >
                  <div>
                    <p className="font-semibold text-ink">{g.name}</p>
                    <p className="text-sm text-stone">
                      {g.members.length} {g.members.length === 1 ? 'member' : 'members'}
                      {g.upgraded ? ' — upgraded' : ''}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-laurel">Open</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
