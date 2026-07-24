import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './store/auth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import Profile from './pages/Profile';
import AuthCallback from './pages/AuthCallback';
import Dashboard from './pages/Dashboard';
import CeremonyNew from './pages/CeremonyNew';
import CeremonyStudio from './pages/CeremonyStudio';
import SignPage from './pages/SignPage';
import Groups from './pages/Groups';
import GroupDetail from './pages/GroupDetail';
import JoinGroup from './pages/JoinGroup';
import PayCallback from './pages/PayCallback';
import Admin from './pages/Admin';

function Protected({ children, adminOnly = false }: { children: JSX.Element; adminOnly?: boolean }) {
  const { user, initializing } = useAuth();
  const location = useLocation();
  if (initializing) {
    return (
      <div className="flex min-h-screen items-center justify-center text-stone">
        Loading your session
      </div>
    );
  }
  if (!user) return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/auth/callback" element={<AuthCallback />} />

      {/* Public signing link — the whole point: no account needed. */}
      <Route path="/sign/:slug" element={<SignPage />} />
      <Route path="/pay/callback" element={<PayCallback />} />

      <Route path="/profile" element={<Protected><Profile /></Protected>} />
      <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
      <Route path="/ceremonies/new" element={<Protected><CeremonyNew /></Protected>} />
      <Route path="/ceremonies/:id" element={<Protected><CeremonyStudio /></Protected>} />
      <Route path="/groups" element={<Protected><Groups /></Protected>} />
      <Route path="/groups/:id" element={<Protected><GroupDetail /></Protected>} />
      <Route path="/join/:code" element={<Protected><JoinGroup /></Protected>} />
      <Route path="/admin" element={<Protected adminOnly><Admin /></Protected>} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
