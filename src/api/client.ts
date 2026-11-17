import axios, { type AxiosRequestConfig, type AxiosResponse } from 'axios';
import {
  clearAuthTokens,
  getAccessToken,
  getRefreshToken,
  getJwtSessionKey,
  setAuthTokens,
} from '../utils/authTokens';
import type { AuthResponse } from '../types';
import { isAuthRejection } from '../utils/authErrors';
import { chatContextCache, isChatContextWrite } from '../utils/chatContextCache';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8080';
let pendingRefresh: { token: string; promise: Promise<AxiosResponse<AuthResponse>> } | undefined;

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  timeout: 90000,
});

function invalidateChatContext(config: AxiosRequestConfig | undefined) {
  if (!isChatContextWrite(config?.method, config?.url)) return;
  const sentToken = String(config?.headers?.Authorization ?? '').replace(/^Bearer /, '');
  const currentToken = getAccessToken();
  if (!sentToken || !currentToken) return;
  const sentSession = getJwtSessionKey(sentToken);
  if (sentSession ? sentSession === getJwtSessionKey(currentToken) : sentToken === currentToken) chatContextCache.clear();
}

function signOutIfCurrent(refreshToken: string | null) {
  if (getRefreshToken() !== refreshToken) return;
  clearAuthTokens();
  if (window.location.pathname !== '/login') window.location.href = '/login';
}

export function refreshSession(refreshToken: string): Promise<AxiosResponse<AuthResponse>> {
  if (getRefreshToken() !== refreshToken) return Promise.reject(new Error('Session changed before refresh'));
  if (!pendingRefresh || pendingRefresh.token !== refreshToken) {
    const promise: Promise<AxiosResponse<AuthResponse>> = axios.post<AuthResponse>(`${BASE_URL}/api/auth/refresh`, { refreshToken },
      { timeout: api.defaults.timeout }).then(response => {
      const data = response.data;
      if (getRefreshToken() !== refreshToken) throw new Error('Session changed during refresh');
      if (typeof data.accessToken !== 'string' || !data.accessToken
        || typeof data.refreshToken !== 'string' || !data.refreshToken) {
        signOutIfCurrent(refreshToken);
        throw new Error('Invalid refresh response');
      }
      setAuthTokens(data.accessToken, data.refreshToken);
      return response;
    }).catch(error => {
      if (isAuthRejection(error)) signOutIfCurrent(refreshToken);
      throw error;
    }).finally(() => {
      if (pendingRefresh?.promise === promise) pendingRefresh = undefined;
    });
    pendingRefresh = { token: refreshToken, promise };
  }
  return pendingRefresh.promise;
}

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => {
    invalidateChatContext(res.config);
    return res;
  },
  async (error) => {
    const original = error.config;
    // A transport/server failure may happen after a write committed.
    invalidateChatContext(original);
    const credentialEndpoint = /\/api\/auth\/(login|demo-login|config|register|refresh)(\?|$)/.test(original?.url ?? '');
    if (error.response?.status === 401 && original && !original._retry && !credentialEndpoint
      && original.headers?.Authorization) {
      const sentToken = String(original.headers.Authorization).replace(/^Bearer /, '');
      const sentSession = getJwtSessionKey(sentToken);
      const currentSession = getJwtSessionKey(getAccessToken());
      if (sentSession && currentSession && sentSession !== currentSession) return Promise.reject(error);
      original._retry = true;
      const refreshToken = getRefreshToken();
      if (refreshToken) {
        try {
          const currentAccess = getAccessToken();
          if (!currentAccess || sentToken === currentAccess) {
            const { data } = await refreshSession(refreshToken);
            if (getRefreshToken() !== data.refreshToken) return Promise.reject(error);
          }
        } catch (refreshError) {
          // Preserve transient refresh failures instead of misreporting the original 401.
          return Promise.reject(refreshError);
        }
        if (['get', 'head'].includes(original.method?.toLowerCase() ?? 'get')) return api(original);
        error.message = 'Session renewed. Please submit again.';
        error.response.data = { ...error.response.data, message: error.message };
      } else {
        signOutIfCurrent(refreshToken);
      }
    }
    return Promise.reject(error);
  },
);

export default api;
