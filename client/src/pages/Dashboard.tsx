import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { CeremonyData } from '../lib/types';
import { useAuth } from '../store/auth';
import { Wordmark, Button } from '../components/ui';

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [ceremonies, setCeremonies] = useState<CeremonyData[] | null>(null);

  useEffect(() => {
    api<{ ceremonies: CeremonyData[] }>('/api/ceremonies')
      .then((d) => setCeremonies(d.ceremonies))
      .catch(() => setCeremonies([]));
  }, []);

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-4xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-5 text-sm font-semibold">
          <Link to="/groups" className="text-ink hover:text-laurel">Groups</Link>
          <Link to="/profile" className="text-ink hover:text-laurel">{user?.name}</Link>
          {user?.role === 'admin' && (
            <Link to="/admin" className="text-laurel hover:text-laurel-dark">Admin</Link>
          )}
          <button onClick={() => logout()} className="text-stone hover:text-danger">Sign out</button>
        </nav>
      </header>

      <main className="mx-auto max-w-4xl px-6 pb-24 pt-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl text-ink">Your ceremonies</h1>
            <span className="signature-line mt-4" />
          </div>
          <Link to="/ceremonies/new">
            <Button>New ceremony</Button>
          </Link>
        </div>

        {ceremonies === null ? (
          <p className="mt-10 text-stone">Loading your ceremonies</p>
        ) : ceremonies.length === 0 ? (
          <div className="mt-10 border border-line bg-white p-10 text-center">
            <h2 className="font-display text-xl text-ink">No ceremonies yet</h2>
            <p className="mx-auto mt-3 max-w-md text-[15px] text-stone">
              A ceremony is one shirt for one occasion — your class, your department, your people.
              Create one, share the link, and watch the signatures land.
            </p>
            <Link to="/ceremonies/new" className="mt-6 inline-block">
              <Button>Create your first ceremony</Button>
            </Link>
          </div>
        ) : (
          <ul className="mt-8 divide-y divide-line border border-line bg-white">
            {ceremonies.map((c) => (
              <li key={c._id}>
                <Link
                  to={`/ceremonies/${c._id}`}
                  className="flex items-center justify-between gap-4 px-5 py-4 hover:bg-laurel-pale/40"
                >
                  <div className="flex items-center gap-4">
                    <span
                      aria-hidden
                      className="h-8 w-8 shrink-0 border border-line"
                      style={{ backgroundColor: c.shirtColor }}
                    />
                    <div>
                      <p className="font-semibold text-ink">{c.title}</p>
                      <p className="text-sm text-stone">
                        {new Date(c.date).toLocaleDateString()}
                        {c.isLocked ? ' — closed' : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-laurel">Open studio</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}
