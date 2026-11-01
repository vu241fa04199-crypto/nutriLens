import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { api, clearToken, getToken, setToken } from '../lib/api';
import type { User } from '../lib/types';

interface AuthContextValue {
  user: User | null;
  booting: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (body: Record<string, unknown>) => Promise<{ user: User; verification?: { sent: boolean } }>;
  logout: () => void;
  setUser: (user: User) => void;
  refresh: () => Promise<void>;
  /** Store a token handed to us by OAuth / password reset, then load the user. */
  adoptToken: (token: string) => Promise<User>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null);
  const [booting, setBooting] = useState(true);

  const refresh = useCallback(async () => {
    if (!getToken()) {
      setUserState(null);
      setBooting(false);
      return;
    }
    try {
      const { user: me } = await api.auth.me();
      setUserState(me);
    } catch {
      clearToken();
      setUserState(null);
    } finally {
      setBooting(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    const onUnauthorized = () => setUserState(null);
    window.addEventListener('nutrilens:unauthorized', onUnauthorized);
    return () => window.removeEventListener('nutrilens:unauthorized', onUnauthorized);
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.auth.login(email, password);
    setToken(res.token);
    setUserState(res.user);
    return res.user;
  }, []);

  const register = useCallback(async (body: Record<string, unknown>) => {
    const res = await api.auth.register(body);
    setToken(res.token);
    setUserState(res.user);
    return { user: res.user, verification: res.verification };
  }, []);

  const adoptToken = useCallback(async (token: string) => {
    setToken(token);
    const { user: me } = await api.auth.me();
    setUserState(me);
    setBooting(false);
    return me;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUserState(null);
  }, []);

  const value = useMemo(
    () => ({ user, booting, login, register, logout, setUser: setUserState, refresh, adoptToken }),
    [user, booting, login, register, logout, refresh, adoptToken]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
