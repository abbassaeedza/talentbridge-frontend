import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';
import { authApi, userApi } from '../api/services';
import type { User, UserRole } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await userApi.getMe();
      setUser(data);
    } catch {
      setUser(null);
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
    }
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      refreshUser().finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const { data } = await authApi.login(email, password);
    localStorage.setItem('accessToken', data.accessToken);
    localStorage.setItem('refreshToken', data.refreshToken);

    // Redirect based on status before loading full user — avoids extra round trip
    if (data.user.status === 'REJECTED') {
      // Store user info so /rejected page can display reason
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

  const logout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
  };

  const isRole = (...roles: UserRole[]) => !!user && roles.includes(user.role);
  const isApproved = user?.status === 'APPROVED';
  const onboardingComplete = user?.role !== 'STUDENT' || !!user?.studentProfile;

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        login,
        logout,
        refreshUser,
        isRole,
        isApproved,
        onboardingComplete,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
