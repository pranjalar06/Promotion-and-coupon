import { createContext, useContext, useEffect, useState, useCallback } from "react";
import api, { getToken, setToken } from "../services/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function bootstrap() {
      const token = getToken();
      if (!token) {
        setLoading(false);
        return;
      }
      try {
        const { user: me } = await api.get("/auth/me");
        setUser(me);
      } catch {
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }
    bootstrap();
  }, []);

  const signup = useCallback(async ({ name, email, password, confirmPassword }) => {
    const result = await api.post("/auth/signup", { name, email, password, confirmPassword });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const login = useCallback(async ({ email, password }) => {
    const result = await api.post("/auth/login", { email, password });
    setToken(result.token);
    setUser(result.user);
    return result.user;
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    loading,
    isAuthenticated: Boolean(user),
    isAdmin: user?.role === "ADMIN",
    signup,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
