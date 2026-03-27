import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

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
  login: (token: string, user: User) => void;
  logout: () => void;
  setPhone: (phone: string) => void;
  setPinSetupCompleted: () => void;
  resetAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [phone, setPhone] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('vp_token');
    const savedUser = localStorage.getItem('vp_user');
    if (token && savedUser) {
      setIsAuthenticated(true);
      setUser(JSON.parse(savedUser));
    }
    setLoading(false);
  }, []);

  const login = (token: string, userData: User) => {
    localStorage.setItem('vp_token', token);
    localStorage.setItem('vp_user', JSON.stringify(userData));
    setIsAuthenticated(true);
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('vp_token');
    // On garde vp_user pour savoir si on affiche le PIN Login ou l'OTP
    setIsAuthenticated(false);
  };

  const setPinSetupCompleted = () => {
    if (user) {
      const updatedUser = { ...user, has_pin: true };
      localStorage.setItem('vp_user', JSON.stringify(updatedUser));
      setUser(updatedUser);
    }
  };

  const resetAccount = () => {
    localStorage.removeItem('vp_token');
    localStorage.removeItem('vp_user');
    setIsAuthenticated(false);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ 
      isAuthenticated, 
      user, 
      phone,
      loading, 
      login, 
      logout, 
      setPhone,
      setPinSetupCompleted, 
      resetAccount 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
