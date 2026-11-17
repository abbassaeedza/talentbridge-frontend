import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authApi, userApi } from '../api/services';
import type { AuthResponse, User, UserRole } from '../types';
import SessionTimeoutModal from '../components/shared/SessionTimeoutModal';
import { isAuthRejection, SERVER_RETRY_MESSAGE } from '../utils/authErrors';
import {
  AUTH_TOKEN_CHANGED_EVENT,
  clearAuthTokens,
  getAccessToken,
  getJwtExpiryMs,
  getJwtSessionKey,
  getRefreshToken,
  setAuthTokens,
} from '../utils/authTokens';

const SESSION_WARNING_MS = 30_000;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: string | null;
  retryUser: () => void;
  login: (email: string, password: string) => Promise<boolean>;
  demoLogin: () => Promise<boolean>;
  completeExternalLogin: (data: AuthResponse) => Promise<boolean>;
  logout: () => void;
  refreshUser: () => Promise<boolean>;
  isRole: (...roles: UserRole[]) => boolean;
  isApproved: boolean;
  onboardingComplete: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const sessionGeneration = useRef(0);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);
  const [sessionError, setSessionError] = useState<string | null>(null);
  const [sessionWarningOpen, setSessionWarningOpen] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(30);
  const [refreshingSession, setRefreshingSession] = useState(false);
  const warningTimerRef = useRef<number | null>(null);
  const expiryTimerRef = useRef<number | null>(null);

  const clearSessionTimers = useCallback(() => {
    if (warningTimerRef.current) window.clearTimeout(warningTimerRef.current);
    if (expiryTimerRef.current) window.clearTimeout(expiryTimerRef.current);
    warningTimerRef.current = null;
    expiryTimerRef.current = null;
  }, []);

  const refreshUser = useCallback(async () => {
    const generation = sessionGeneration.current;
    const session = getJwtSessionKey(getAccessToken());
    const stillCurrent = () => sessionGeneration.current === generation
      && getJwtSessionKey(getAccessToken()) === session;
    setAuthError(null);
    try {
      const { data } = await userApi.getMe();
      if (stillCurrent() && getAccessToken()) {
        if (data.status === 'SUSPENDED') clearAuthTokens();
        else {
          setUser(data);
          return true;
        }
      }
    } catch (error) {
      if (stillCurrent()) {
        if (isAuthRejection(error)) clearAuthTokens();
        else setAuthError(SERVER_RETRY_MESSAGE);
      }
    } finally {
      if (stillCurrent()) setLoading(false);
    }
    return false;
  }, []);

  const retryUser = useCallback(() => {
    setLoading(true);
    void refreshUser();
  }, [refreshUser]);

  const redirectToLogin = useCallback(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  const logout = useCallback(() => {
    sessionGeneration.current += 1;
    void queryClient.cancelQueries();
    queryClient.clear();
    clearSessionTimers();
    setSessionWarningOpen(false);
    setRefreshingSession(false);
    setAuthError(null);
    setSessionError(null);
    setLoading(false);
    clearAuthTokens();
    setUser(null);
  }, [clearSessionTimers, queryClient]);

  const expireSession = useCallback(() => {
    logout();
    redirectToLogin();
  }, [logout, redirectToLogin]);

  const scheduleSessionTimeout = useCallback(() => {
    clearSessionTimers();

    const token = getAccessToken();
    if (!token) {
      setSessionWarningOpen(false);
      return;
    }

    const expiryMs = getJwtExpiryMs(token);
    if (!expiryMs) {
      setSessionWarningOpen(false);
      return;
    }

    const msUntilExpiry = expiryMs - Date.now();
    if (msUntilExpiry <= 0) {
      expireSession();
      return;
    }

    if (user) {
      const msUntilWarning = Math.max(0, msUntilExpiry - SESSION_WARNING_MS);
      warningTimerRef.current = window.setTimeout(() => {
        if (getAccessToken() !== token) return;
        setSessionWarningOpen(true);
        setSecondsRemaining(Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000)));
      }, msUntilWarning);
    }

    expiryTimerRef.current = window.setTimeout(() => {
      if (getAccessToken() === token) expireSession();
    }, msUntilExpiry);
  }, [clearSessionTimers, expireSession, user]);

  useEffect(() => {
    const syncSessionTimers = (event?: Event) => {
      if (!getAccessToken()) {
        sessionGeneration.current += 1;
        void queryClient.cancelQueries();
        queryClient.clear();
        setUser(null);
        setSessionWarningOpen(false);
        setRefreshingSession(false);
        setAuthError(null);
        setSessionError(null);
        setLoading(false);
      } else if (event instanceof StorageEvent && event.key === 'accessToken') {
        const previous = getJwtSessionKey(event.oldValue);
        const next = getJwtSessionKey(event.newValue);
        if (previous && previous === next) {
          if ((getJwtExpiryMs(event.newValue!) ?? 0) > Date.now() + SESSION_WARNING_MS) {
            setSessionWarningOpen(false);
            setRefreshingSession(false);
            setSessionError(null);
          }
        } else {
          sessionGeneration.current += 1;
          void queryClient.cancelQueries();
          queryClient.clear();
          setUser(null);
          setSessionWarningOpen(false);
          setRefreshingSession(false);
          setSessionError(null);
          setAuthError(null);
          setLoading(true);
          void refreshUser();
        }
      }
      scheduleSessionTimeout();
    };

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncSessionTimers);
    window.addEventListener('storage', syncSessionTimers);
    scheduleSessionTimeout();

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncSessionTimers);
      window.removeEventListener('storage', syncSessionTimers);
      clearSessionTimers();
    };
  }, [clearSessionTimers, scheduleSessionTimeout, queryClient, refreshUser]);

  useEffect(() => {
    if (!sessionWarningOpen) return;

    const tick = () => {
      const token = getAccessToken();
      const expiryMs = token ? getJwtExpiryMs(token) : null;
      if (!expiryMs) {
        expireSession();
        return;
      }

      const seconds = Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000));
      setSecondsRemaining(seconds);
      if (seconds <= 0) expireSession();
    };

    tick();
    const interval = window.setInterval(tick, 1000);
    return () => window.clearInterval(interval);
  }, [expireSession, sessionWarningOpen]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      void refreshUser();
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const completeLogin = async (data: AuthResponse) => {
    sessionGeneration.current += 1;
    clearSessionTimers();
    setSessionWarningOpen(false);
    setRefreshingSession(false);
    setAuthError(null);
    setSessionError(null);
    void queryClient.cancelQueries();
    queryClient.clear();
    setUser(null);
    setAuthTokens(data.accessToken, data.refreshToken);

    // Redirect based on status before loading the full user.
    if (data.user.status === 'REJECTED') {
      setUser(data.user as unknown as User);
      setLoading(false);
      window.location.href = '/rejected';
      return false;
    }

    if (data.user.status === 'PENDING') {
      setUser(data.user as unknown as User);
      setLoading(false);
      window.location.href = '/pending';
      return false;
    }

    return refreshUser();
  };

  const authenticate = async (request: () => Promise<{ data: AuthResponse }>) => {
    const generation = sessionGeneration.current;
    const initialAccess = getAccessToken();
    const initialRefresh = getRefreshToken();
    const { data } = await request();
    if (sessionGeneration.current !== generation || getAccessToken() !== initialAccess
      || getRefreshToken() !== initialRefresh) return false;
    await completeLogin(data);
    return sessionGeneration.current === generation + 1;
  };

  const login = (email: string, password: string) => authenticate(() => authApi.login(email, password));
  const demoLogin = () => authenticate(authApi.demoLogin);

  const externalLoginGeneration = sessionGeneration.current;
  const completeExternalLogin = async (data: AuthResponse) => {
    if (sessionGeneration.current !== externalLoginGeneration || getAccessToken()) return false;
    return completeLogin(data);
  };

  const stayLoggedIn = async () => {
    if (refreshingSession) return;
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      expireSession();
      return;
    }

    const generation = sessionGeneration.current;
    const session = getJwtSessionKey(getAccessToken());
    const stillCurrent = () => sessionGeneration.current === generation
      && getJwtSessionKey(getAccessToken()) === session;
    setRefreshingSession(true);
    setSessionError(null);
    try {
      const { data } = await authApi.refresh(refreshToken);
      if (!stillCurrent() || getRefreshToken() !== data.refreshToken) return;
      await refreshUser();
      if (stillCurrent()) setSessionWarningOpen(false);
    } catch (error) {
      if (stillCurrent() && getRefreshToken() === refreshToken) {
        const expiryMs = getJwtExpiryMs(getAccessToken() ?? '');
        if (isAuthRejection(error) || !expiryMs || expiryMs <= Date.now()) expireSession();
        else setSessionError(SERVER_RETRY_MESSAGE);
      }
    } finally {
      if (stillCurrent()) setRefreshingSession(false);
    }
  };

  const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);
  const isApproved = user?.status === 'APPROVED';
  const onboardingComplete = user?.role === 'STUDENT'
    ? !!user.studentProfile
    : user?.role === 'PARTY_SUPERVISOR'
      ? !!user.supervisorProfile
      : true;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        authError,
        retryUser,
        login,
        demoLogin,
        completeExternalLogin,
        logout,
        refreshUser,
        isRole,
        isApproved,
        onboardingComplete,
      }}
    >
      {children}
      <SessionTimeoutModal
        open={sessionWarningOpen}
        secondsRemaining={secondsRemaining}
        refreshing={refreshingSession}
        error={sessionError}
        onStayLoggedIn={stayLoggedIn}
        onSignOut={expireSession}
      />
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
