import { createContext, useContext, useState, useEffect, useCallback, useRef, type ReactNode } from 'react';
import { apiClient, setSessionExpiredHandler } from '../services/apiClient';

interface User {
  id: string;
  phone?: string;
  email?: string;
  role: string;
  has_pin: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  phone: string | null;
  loading: boolean;
  isLocked: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  lock: () => void;
  unlock: () => void;
  setPhone: (phone: string) => void;
  setPinSetupCompleted: () => void;
  resetAccount: () => void;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// 25s for dev, 5min for production
const INACTIVITY_TIMEOUT = import.meta.env.PROD ? 5 * 60 * 1000 : 25 * 1000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isLocked, setIsLocked] = useState(false);

  // Use refs to avoid stale closures in the inactivity timer
  const isAuthenticatedRef = useRef(isAuthenticated);
  const isLockedRef = useRef(isLocked);
  const timerRef = useRef<number | null>(null);
  const lastActivityRef = useRef(0);
  const pollPauseUntilRef = useRef(0);
  const consecutiveErrorsRef = useRef(0);

  useEffect(() => { isAuthenticatedRef.current = isAuthenticated; }, [isAuthenticated]);
  useEffect(() => { isLockedRef.current = isLocked; }, [isLocked]);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const lock = useCallback(() => {
    if (isAuthenticatedRef.current) {
      // Store route WITHOUT the basename (router adds it back on navigate)
      const pathname = window.location.pathname;
      const cleanPath = pathname.replace(/^\/mobile/, '') || '/dashboard';
      sessionStorage.setItem('vp_last_route', cleanPath);
      setIsLocked(true);
      clearTimer();
    }
  }, [clearTimer]);

  const unlock = useCallback(() => {
    setIsLocked(false);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('vp_token');
    localStorage.removeItem('vp_user');
    setUser(null);
    setIsAuthenticated(false);
    setIsLocked(false);
    clearTimer();
  }, [clearTimer]);

  // Register session expired handler with apiClient so 401 responses trigger logout
  useEffect(() => {
    setSessionExpiredHandler(() => {
      logout();
      // If on lock screen, stay there; otherwise navigate to login
      const onLock = window.location.pathname.includes('/auth/lock');
      if (!onLock) {
        window.location.href = '/mobile/auth/login';
      }
    });
  }, [logout]);

  // Reset the inactivity timer on user activity
  const resetTimer = useCallback(() => {
    lastActivityRef.current = Date.now();
    clearTimer();
    if (isAuthenticatedRef.current && !isLockedRef.current) {
      timerRef.current = window.setTimeout(() => {
        lock();
      }, INACTIVITY_TIMEOUT);
    }
  }, [clearTimer, lock]);

  // Register event listeners for user activity
  useEffect(() => {
    if (!isAuthenticated || isLocked) {
      clearTimer();
      return;
    }

    const events = ['mousedown', 'mousemove', 'keydown', 'scroll', 'touchstart', 'touchmove', 'click'];
    const handler = () => resetTimer();
    events.forEach(event => window.addEventListener(event, handler, { passive: true }));

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        const elapsed = Date.now() - lastActivityRef.current;
        if (elapsed >= INACTIVITY_TIMEOUT) {
          lock();
        } else {
          resetTimer();
        }
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    resetTimer();

    const intervalId = window.setInterval(() => {
      if (!isAuthenticatedRef.current || isLockedRef.current) return;

      // If server is under load, pause polling temporarily
      if (Date.now() < pollPauseUntilRef.current) {
        return;
      }

      const elapsed = Date.now() - lastActivityRef.current;
      if (elapsed >= INACTIVITY_TIMEOUT) {
        lock();
      }
    }, 5000);

    return () => {
      clearTimer();
      window.clearInterval(intervalId);
      events.forEach(event => window.removeEventListener(event, handler));
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [isAuthenticated, isLocked, resetTimer, clearTimer, lock]);

  // Load persisted session on mount
  useEffect(() => {
    lastActivityRef.current = Date.now();
    const token = localStorage.getItem('vp_token');
    const savedUser = localStorage.getItem('vp_user');

    if (savedUser) {
      try {
        const parsedUser = JSON.parse(savedUser) as User;
        setUser(parsedUser);
        if (token) {
          setIsAuthenticated(true);
        }
      } catch (err) {
        console.error("Auth session parsing error", err);
        localStorage.removeItem('vp_token');
        localStorage.removeItem('vp_user');
      }
    }
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = useCallback((token: string, userData: User) => {
    localStorage.setItem('vp_token', token);
    localStorage.setItem('vp_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setIsLocked(false);
    setUser(userData);
    consecutiveErrorsRef.current = 0;
    pollPauseUntilRef.current = 0;
  }, []);

  const setPinSetupCompleted = useCallback(() => {
    setUser(prev => {
      if (!prev) return null;
      const updatedUser = { ...prev, has_pin: true };
      localStorage.setItem('vp_user', JSON.stringify(updatedUser));
      return updatedUser;
    });
  }, []);

  const resetAccount = useCallback(() => {
    localStorage.removeItem('vp_token');
    localStorage.removeItem('vp_user');
    setIsAuthenticated(false);
    setUser(null);
    setIsLocked(false);
    clearTimer();
  }, [clearTimer]);

  const deleteAccount = async () => {
    try {
      await apiClient.delete('/auth/account');
    } catch {
      // API may not exist yet, proceed with local cleanup
    }
    localStorage.removeItem('vp_token');
    localStorage.removeItem('vp_user');
    setIsAuthenticated(false);
    setUser(null);
    setIsLocked(false);
    clearTimer();
  };

  return (
    <AuthContext.Provider value={{
      isAuthenticated,
      user,
      phone,
      loading,
      isLocked,
      login,
      logout,
      lock,
      unlock,
      setPhone,
      setPinSetupCompleted,
      resetAccount,
      deleteAccount,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
