import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { authApi, RegisterInput } from '../api/endpoints';
import { tokenStore } from '../api/client';
import { User } from '../types';

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore session from a stored token, if any.
    if (!tokenStore.access()) {
      setLoading(false);
      return;
    }
    authApi.profile()
      .then(setUser)
      .catch(() => tokenStore.clear())
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login(email, password);
    tokenStore.set(data.access_token, data.refresh_token);
    setUser(data.user);
    return data.user;
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await authApi.register(input);
    tokenStore.set(data.access_token, data.refresh_token);
    setUser(data.user);
  }, []);

  const logout = useCallback(() => {
    // Best-effort: revoke the session server-side too, so the refresh token
    // this browser was holding stops working — not just a local token wipe.
    // Fire-and-forget so a slow/failed request never blocks signing out.
    authApi.logout().catch(() => {});
    tokenStore.clear();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export const isSecurity = (role?: string) => role === 'analyst' || role === 'admin';
export const isWorkspace = (role?: string) =>
  role === 'employee' || role === 'manager' || role === 'admin';
export const isAdmin = (role?: string) => role === 'admin';
