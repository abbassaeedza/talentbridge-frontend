import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
  useRef,
} from 'react';
import { authApi, userApi } from '../api/services';
import type { AuthResponse, User, UserRole } from '../types';
import SessionTimeoutModal from '../components/shared/SessionTimeoutModal';
import {
  AUTH_TOKEN_CHANGED_EVENT,
  clearAuthTokens,
  getAccessToken,
  getJwtExpiryMs,
  getRefreshToken,
  setAuthTokens,
} from '../utils/authTokens';

const SESSION_WARNING_MS = 30_000;

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  demoLogin: () => Promise<void>;
  completeExternalLogin: (data: AuthResponse) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  isRole: (...roles: UserRole[]) => boolean;
  isApproved: boolean;
  onboardingComplete: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
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
    try {
      const { data } = await userApi.getMe();
      setUser(data);
    } catch {
      setUser(null);
      clearAuthTokens();
    }
  }, []);

  const redirectToLogin = useCallback(() => {
    if (window.location.pathname !== '/login') {
      window.location.href = '/login';
    }
  }, []);

  const logout = useCallback(() => {
    clearSessionTimers();
    setSessionWarningOpen(false);
    clearAuthTokens();
    setUser(null);
  }, [clearSessionTimers]);

  const expireSession = useCallback(() => {
    logout();
    redirectToLogin();
  }, [logout, redirectToLogin]);

  const scheduleSessionTimeout = useCallback(() => {
    clearSessionTimers();

    const token = getAccessToken();
    if (!user || !token) {
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

    const msUntilWarning = Math.max(0, msUntilExpiry - SESSION_WARNING_MS);
    warningTimerRef.current = window.setTimeout(() => {
      setSessionWarningOpen(true);
      setSecondsRemaining(Math.max(0, Math.ceil((expiryMs - Date.now()) / 1000)));
    }, msUntilWarning);

    expiryTimerRef.current = window.setTimeout(expireSession, msUntilExpiry);
  }, [clearSessionTimers, expireSession, user]);

  useEffect(() => {
    const syncSessionTimers = () => scheduleSessionTimeout();

    window.addEventListener(AUTH_TOKEN_CHANGED_EVENT, syncSessionTimers);
    window.addEventListener('storage', syncSessionTimers);
    scheduleSessionTimeout();

    return () => {
      window.removeEventListener(AUTH_TOKEN_CHANGED_EVENT, syncSessionTimers);
      window.removeEventListener('storage', syncSessionTimers);
      clearSessionTimers();
    };
  }, [clearSessionTimers, scheduleSessionTimeout]);

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
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const completeLogin = async (data: AuthResponse) => {
    setAuthTokens(data.accessToken, data.refreshToken);

    // Redirect based on status before loading the full user.
    if (data.user.status === 'REJECTED') {
      setUser(data.user as unknown as User);
      setLoading(false);
      window.location.href = '/rejected';
      return;
    }

    if (data.user.status === 'PENDING') {
      setUser(data.user as unknown as User);
      setLoading(false);
      window.location.href = '/pending';
      return;
    }

    await refreshUser();
  };

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    await completeLogin(data);
  };

  const demoLogin = async () => {
    const { data } = await authApi.demoLogin();
    await completeLogin(data);
  };

  const completeExternalLogin = async (data: AuthResponse) => completeLogin(data);

  const stayLoggedIn = async () => {
    const refreshToken = getRefreshToken();
    if (!refreshToken) {
      expireSession();
      return;
    }

    setRefreshingSession(true);
    try {
      const { data } = await authApi.refresh(refreshToken);
      setAuthTokens(data.accessToken, data.refreshToken);
      setUser(data.user as unknown as User);
      await refreshUser();
      setSessionWarningOpen(false);
    } catch {
      expireSession();
    } finally {
      setRefreshingSession(false);
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
