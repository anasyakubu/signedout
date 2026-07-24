import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api, ApiError } from '../lib/api';
import { GroupData } from '../lib/types';
import { Wordmark, FormError } from '../components/ui';
import { useAuth } from '../store/auth';

export default function JoinGroup() {
  const { code } = useParams<{ code: string }>();
  const { user, initializing } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const attempted = useRef(false);

  useEffect(() => {
    if (initializing || attempted.current) return;
    if (!user) {
      // Come back to this join link after signing in.
      navigate(`/login?next=/join/${code}`, { replace: true });
      return;
    }
    attempted.current = true;
    api<{ group: GroupData }>(`/api/groups/join/${code}`, { method: 'POST' })
      .then((d) => navigate(`/groups/${d.group._id}`, { replace: true }))
      .catch((err) => {
        if (err instanceof ApiError && err.status === 402) {
          setError(
            'This group is at its free member limit. Ask the group owner to upgrade it, then try the link again.'
          );
        } else {
          setError(err instanceof ApiError ? err.message : 'Joining failed.');
        }
      });
  }, [user, initializing, code, navigate]);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center px-6 pt-24">
      <Wordmark />
      <div className="mt-12 w-full text-center">
        {error ? (
          <>
            <FormError message={error} />
            <Link to="/dashboard" className="mt-4 inline-block text-sm font-semibold text-laurel">
              Go to your dashboard
            </Link>
          </>
        ) : (
          <p className="text-stone">Joining the group</p>
        )}
      </div>
    </div>
  );
}
