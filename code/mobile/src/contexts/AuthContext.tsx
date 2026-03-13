import { createContext, useContext, useState, type ReactNode } from 'react';

interface AuthContextType {
  isAuthenticated: boolean;
  userId: string | null;
  login: () => void;
  logout: () => void;
  resetAccount: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// TODO AUTH-01 : implémenter OTP + PIN + Passkeys WebAuthn
export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const login = () => {
    setIsAuthenticated(true);
    setUserId('dummy-user');
  };

  const logout = () => {
    // efface tokens, conserve vp_user_id (reconnexion PIN)
    setIsAuthenticated(false);
  };

  const resetAccount = () => {
    // efface tout (tokens + userId + passkey)
    setIsAuthenticated(false);
    setUserId(null);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, userId, login, logout, resetAccount }}>
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
};
