import { Link } from 'react-router-dom';
import { FormEvent, useState } from 'react';
import { useAuth } from '../store/auth';
import { api, ApiError, PublicUser } from '../lib/api';
import { Wordmark, Field, Button, FormError } from '../components/ui';

export default function Profile() {
  const { user, setUser, logout } = useAuth();
  const [editing, setEditing] = useState(false);

  if (!user) return null;

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-3xl items-center justify-between px-6 py-6">
        <Wordmark />
        <button
          onClick={() => logout()}
          className="text-sm font-semibold text-stone hover:text-danger"
        >
          Sign out
        </button>
      </header>

      <main className="mx-auto max-w-3xl px-6 pb-24 pt-10">
        <div className="flex items-start justify-between gap-6">
          <div className="flex items-center gap-5">
            {user.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-16 w-16 border border-line object-cover"
              />
            ) : (
              <div
                aria-hidden
                className="flex h-16 w-16 items-center justify-center bg-laurel-pale font-display text-2xl text-laurel"
              >
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h1 className="font-display text-3xl text-ink">{user.name}</h1>
              <p className="mt-1 text-sm text-stone">{user.email}</p>
            </div>
          </div>
          {!editing && (
            <Button variant="secondary" onClick={() => setEditing(true)}>
              Edit profile
            </Button>
          )}
        </div>
        <span className="signature-line mt-6" />

        {editing ? (
          <EditForm
            user={user}
            onSaved={(u) => {
              setUser(u);
              setEditing(false);
            }}
            onCancel={() => setEditing(false)}
          />
        ) : (
          <dl className="mt-10 grid gap-x-10 gap-y-6 sm:grid-cols-2">
            <Detail label="School" value={user.school} />
            <Detail label="Department" value={user.department} />
            <Detail label="Graduation year" value={user.graduationYear?.toString() ?? null} />
            <Detail
              label="Sign-in method"
              value={
                user.authProvider === 'both'
                  ? 'Email and Google'
                  : user.authProvider === 'google'
                    ? 'Google'
                    : 'Email and password'
              }
            />
            <div className="sm:col-span-2">
              <Detail label="Bio" value={user.bio} />
            </div>
          </dl>
        )}

        <section className="mt-16 border-t border-line pt-10">
          <h2 className="font-display text-xl text-ink">Your ceremonies</h2>
          <p className="mt-3 max-w-lg text-[15px] leading-relaxed text-stone">
            Create a shirt for your class, share the signing link, and download the final print
            file from your dashboard.
          </p>
          <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-laurel hover:text-laurel-dark">
            Go to your ceremonies
          </Link>
        </section>
      </main>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-widest text-stone">{label}</dt>
      <dd className="mt-1.5 text-[15px] text-ink">
        {value || <span className="text-stone/60">Not set</span>}
      </dd>
    </div>
  );
}

function EditForm({
  user,
  onSaved,
  onCancel,
}: {
  user: PublicUser;
  onSaved: (u: PublicUser) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(user.name);
  const [school, setSchool] = useState(user.school ?? '');
  const [department, setDepartment] = useState(user.department ?? '');
  const [graduationYear, setGraduationYear] = useState(user.graduationYear?.toString() ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const body: Record<string, unknown> = { name, school, department, bio };
      if (graduationYear.trim()) body.graduationYear = Number(graduationYear);
      const data = await api<{ user: PublicUser }>('/api/users/me', {
        method: 'PATCH',
        body: JSON.stringify(body),
      });
      onSaved(data.user);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not save your changes. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 space-y-5">
      <FormError message={error} />
      <Field label="Full name" value={name} onChange={(e) => setName(e.target.value)} required />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="School" value={school} onChange={(e) => setSchool(e.target.value)} />
        <Field
          label="Department"
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
        />
      </div>
      <Field
        label="Graduation year"
        type="number"
        min={1950}
        max={2100}
        value={graduationYear}
        onChange={(e) => setGraduationYear(e.target.value)}
      />
      <div>
        <label htmlFor="bio" className="mb-1.5 block text-sm font-semibold text-ink">
          Bio
        </label>
        <textarea
          id="bio"
          rows={3}
          maxLength={500}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          className="w-full border border-line bg-white px-3.5 py-2.5 text-[15px] text-ink focus:border-laurel focus:outline-none"
        />
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving' : 'Save changes'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
