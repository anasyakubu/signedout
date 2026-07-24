import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  ReactNode,
} from 'react';
import { api, refreshSession, setAccessToken, PublicUser } from '../lib/api';

interface AuthState {
  user: PublicUser | null;
  initializing: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: PublicUser) => void;
  reloadSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<PublicUser | null>(null);
  const [initializing, setInitializing] = useState(true);

  const reloadSession = useCallback(async () => {
    const session = await refreshSession();
    setUserState(session?.user ?? null);
  }, []);

  useEffect(() => {
    reloadSession().finally(() => setInitializing(false));
  }, [reloadSession]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await api<{ accessToken: string; user: PublicUser }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    setAccessToken(data.accessToken);
    setUserState(data.user);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const data = await api<{ accessToken: string; user: PublicUser }>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    setAccessToken(data.accessToken);
    setUserState(data.user);
  }, []);

  const logout = useCallback(async () => {
    await api('/api/auth/logout', { method: 'POST' });
    setAccessToken(null);
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({
      user,
      initializing,
      login,
      register,
      logout,
      setUser: setUserState,
      reloadSession,
    }),
    [user, initializing, login, register, logout, reloadSession]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
