import { Link } from 'react-router-dom';
import { useAuth } from '../store/auth';
import { Wordmark, Button } from '../components/ui';

export default function Landing() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-5xl items-center justify-between px-6 py-6">
        <Wordmark />
        <nav className="flex items-center gap-4">
          {user ? (
            <Link to="/profile" className="text-sm font-semibold text-laurel hover:text-laurel-dark">
              {user.name}
            </Link>
          ) : (
            <>
              <Link to="/login" className="text-sm font-semibold text-ink hover:text-laurel">
                Sign in
              </Link>
              <Link to="/register">
                <Button>Create account</Button>
              </Link>
            </>
          )}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-6 pb-24 pt-16 md:pt-28">
        <p className="text-sm font-semibold uppercase tracking-widest text-laurel">
          For the class that could not gather
        </p>
        <h1 className="mt-4 max-w-3xl font-display text-4xl leading-tight text-ink md:text-6xl">
          The shirt-signing tradition, kept.
        </h1>
        <span className="signature-line mt-6" />
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-stone">
          Create a ceremony for your graduating class, share one link, and let everyone sign a
          shirt they can hold in their hands — printed from a file you download when the last
          signature lands.
        </p>
        <div className="mt-10 flex flex-wrap gap-3">
          <Link to={user ? '/profile' : '/register'}>
            <Button>{user ? 'Go to your profile' : 'Start a ceremony'}</Button>
          </Link>
          <Link to="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>

        <section className="mt-24 grid gap-10 border-t border-line pt-12 md:grid-cols-3">
          <div>
            <h2 className="font-display text-lg text-ink">One shirt, everyone's name</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone">
              Classmates sign with styled text, a drawn signature, or an image — no account
              needed, just the link.
            </p>
          </div>
          <div>
            <h2 className="font-display text-lg text-ink">A real, printable keepsake</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone">
              Download a print-ready file with every signature placed exactly where it was signed,
              and take it to any print shop.
            </p>
          </div>
          <div>
            <h2 className="font-display text-lg text-ink">Built for whole classes</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-stone">
              Groups let a class share one design, with editors who shape it and members who sign
              it.
            </p>
          </div>
        </section>
      </main>
    </div>
  );
}
