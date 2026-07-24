import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../store/auth';

// Google redirects here after setting the refresh cookie server-side; one
// refresh call picks up the session, then we land on the profile.
export default function AuthCallback() {
  const { reloadSession } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    reloadSession()
      .then(() => navigate('/profile', { replace: true }))
      .catch(() => navigate('/login?error=oauth_failed', { replace: true }));
  }, [reloadSession, navigate]);

  return (
    <div className="flex min-h-screen items-center justify-center text-stone">
      Finishing sign-in
    </div>
  );
}
