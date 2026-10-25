import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../lib/api";
import type { User } from "../lib/types";

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signOut: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshUser = useCallback(async () => {
    const token = localStorage.getItem("namsamart-token");
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const result = await api.get<{ user: User }>("/auth/me");
      setUser(result.data.user);
    } catch {
      localStorage.removeItem("namsamart-token");
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void refreshUser(); }, [refreshUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await api.post<{ token: string; user: User }>("/auth/login", { email, password });
    localStorage.setItem("namsamart-token", result.data.token);
    setUser(result.data.user);
    return result.data.user;
  }, []);

  const signOut = useCallback(() => {
    localStorage.removeItem("namsamart-token");
    setUser(null);
  }, []);

  const value = useMemo(() => ({ user, loading, signIn, signOut, refreshUser }), [user, loading, signIn, signOut, refreshUser]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider.");
  return context;
}
