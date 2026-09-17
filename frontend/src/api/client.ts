import axios, { AxiosError } from "axios";

// Points at the real backend built in ../../backend — nothing in this
// app is mocked. See ../.env.example for how to point this at a
// different host (e.g. a deployed API instead of localhost).
const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3000/api/v1";

export const api = axios.create({ baseURL: API_URL });

function getTokens() {
  return {
    accessToken: localStorage.getItem("sankofa:accessToken"),
    refreshToken: localStorage.getItem("sankofa:refreshToken"),
  };
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem("sankofa:accessToken", accessToken);
  localStorage.setItem("sankofa:refreshToken", refreshToken);
}

export function clearTokens() {
  localStorage.removeItem("sankofa:accessToken");
  localStorage.removeItem("sankofa:refreshToken");
}

api.interceptors.request.use((config) => {
  const { accessToken } = getTokens();
  if (accessToken) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Auth-service backend rotates refresh tokens on every use (spec §41).
// This interceptor makes that invisible to the rest of the app: on a
// 401 it transparently swaps in a fresh access token and retries once.
let refreshingPromise: Promise<string | null> | null = null;

async function performRefresh(): Promise<string | null> {
  const { refreshToken } = getTokens();
  if (!refreshToken) return null;
  try {
    const res = await axios.post(`${API_URL}/auth/refresh`, { refreshToken });
    const { accessToken, refreshToken: newRefreshToken } = res.data.data;
    setTokens(accessToken, newRefreshToken);
    return accessToken;
  } catch {
    clearTokens();
    return null;
  }
}

api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    const original = error.config as (typeof error.config & { _retried?: boolean }) | undefined;
    if (error.response?.status === 401 && original && !original._retried && !original.url?.includes("/auth/")) {
      original._retried = true;
      if (!refreshingPromise) refreshingPromise = performRefresh().finally(() => (refreshingPromise = null));
      const newToken = await refreshingPromise;
      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      }
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

export function apiErrorMessage(err: unknown): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error?.message ?? err.message ?? "Something went wrong";
  }
  return "Something went wrong";
}
