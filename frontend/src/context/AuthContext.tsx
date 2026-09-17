import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api, clearTokens, setTokens } from "@/api/client";
import { connectSocket, disconnectSocket, getSocket } from "@/api/socket";
import type { Me } from "@/lib/types";

interface AuthContextValue {
  me: Me | null;
  loading: boolean;
  requestOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, otp: string) => Promise<Me>;
  logout: () => Promise<void>;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshMe = useCallback(async () => {
    const hasToken = !!localStorage.getItem("sankofa:accessToken");
    if (!hasToken) {
      setMe(null);
      setLoading(false);
      return;
    }
    try {
      const res = await api.get("/users/me");
      setMe(res.data.data);
      connectSocket();
    } catch {
      setMe(null);
      clearTokens();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const requestOtp = useCallback(async (phone: string) => {
    await api.post("/auth/request-otp", { phone });
  }, []);

  const verifyOtp = useCallback(async (phone: string, otp: string) => {
    const res = await api.post("/auth/verify-otp", { phone, otp });
    const { accessToken, refreshToken, user } = res.data.data;
    setTokens(accessToken, refreshToken);
    const meRes = await api.get("/users/me");
    setMe(meRes.data.data);
    connectSocket();
    return meRes.data.data as Me;
  }, []);

  const logout = useCallback(async () => {
    const refreshToken = localStorage.getItem("sankofa:refreshToken");
    try {
      if (refreshToken) await api.post("/auth/logout", { refreshToken });
    } catch {
      /* best effort */
    }
    clearTokens();
    disconnectSocket();
    setMe(null);
  }, []);

  const value = useMemo(
    () => ({ me, loading, requestOtp, verifyOtp, logout, refreshMe }),
    [me, loading, requestOtp, verifyOtp, logout, refreshMe]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export { getSocket };
