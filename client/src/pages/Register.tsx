import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Wordmark, Field, Button, FormError } from '../components/ui';
import { ApiError } from '../lib/api';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await register(name, email, password);
      navigate('/profile', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not create your account. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col px-6 py-10">
      <Wordmark />
      <main className="mt-16">
        <h1 className="font-display text-3xl text-ink">Create your account</h1>
        <span className="signature-line mt-4" />
        <form onSubmit={onSubmit} className="mt-8 space-y-5">
          <FormError message={error} />
          <Field
            label="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="name"
            required
          />
          <Field
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
          <Field
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
            minLength={8}
            required
          />
          <Button type="submit" disabled={busy} className="w-full">
            {busy ? 'Creating account' : 'Create account'}
          </Button>
        </form>
        <a
          href="/api/auth/google"
          className="mt-3 flex w-full items-center justify-center border border-line bg-white px-5 py-2.5 text-[15px] font-semibold text-ink hover:border-laurel hover:text-laurel"
        >
          Continue with Google
        </a>
        <p className="mt-8 text-sm text-stone">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-laurel hover:text-laurel-dark">
            Sign in
          </Link>
        </p>
      </main>
    </div>
  );
}
