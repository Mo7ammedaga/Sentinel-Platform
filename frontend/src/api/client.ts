import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export const API_BASE =
  process.env.REACT_APP_API_URL || 'http://localhost:5000';

const ACCESS_KEY = 'sentinel_access';
const REFRESH_KEY = 'sentinel_refresh';

export const tokenStore = {
  access: () => localStorage.getItem(ACCESS_KEY),
  refresh: () => localStorage.getItem(REFRESH_KEY),
  set: (access: string, refresh?: string) => {
    localStorage.setItem(ACCESS_KEY, access);
    if (refresh) localStorage.setItem(REFRESH_KEY, refresh);
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY);
    localStorage.removeItem(REFRESH_KEY);
  },
};

export const api = axios.create({ baseURL: `${API_BASE}/api/v1` });

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = tokenStore.access();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// On a 401, try once to refresh the access token, then replay the request.
let refreshing: Promise<string | null> | null = null;

async function tryRefresh(): Promise<string | null> {
  const refresh = tokenStore.refresh();
  if (!refresh) return null;
  try {
    const res = await axios.post(`${API_BASE}/api/v1/auth/refresh`, {
      refresh_token: refresh,
    });
    const access = res.data.access_token as string;
    tokenStore.set(access);
    return access;
  } catch {
    tokenStore.clear();
    return null;
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retried?: boolean };
    if (error.response?.status === 401 && original && !original._retried) {
      original._retried = true;
      refreshing = refreshing || tryRefresh();
      const access = await refreshing;
      refreshing = null;
      if (access) {
        original.headers.Authorization = `Bearer ${access}`;
        return api(original);
      }
      // Refresh failed: force re-login.
      if (window.location.pathname !== '/login') window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export function apiError(e: unknown): string {
  const err = e as AxiosError<{ error?: string; details?: unknown }>;
  return err.response?.data?.error || err.message || 'Request failed';
}
