import { type User, AgentRole } from '@/types/auth';

const API_BASE = '/api/v1';
const TOKEN_KEY = 'veripass_access_token';
const REFRESH_KEY = 'veripass_refresh_token';
const USER_KEY = 'veripass_user';
const MOCK_STORAGE_ENCRYPTION_SECRET = 'veripass-mock-storage-secret';
const MOCK_STORAGE_ENCRYPTION_SALT = 'veripass-mock-storage-salt';

// Mock users matching backend seed_data.py personas
const MOCK_USERS: Record<string, User & { password: string }> = {
  'jean@bicec.cm': {
    id: '1',
    email: 'jean@bicec.cm',
    name: 'Jean Dupont',
    role: AgentRole.JEAN,
    agencyId: 'agency-1',
    password: 'password123',
  },
  'thomas@bicec.cm': {
    id: '2',
    email: 'thomas@bicec.cm',
    name: 'Thomas Martin',
    role: AgentRole.THOMAS,
    agencyId: 'agency-1',
    password: 'password123',
  },
  'sylvie@bicec.cm': {
    id: '3',
    email: 'sylvie@bicec.cm',
    name: 'Sylvie Bernard',
    role: AgentRole.SYLVIE,
    agencyId: 'agency-1',
    password: 'password123',
  },
  'admin@bicec.cm': {
    id: '4',
    email: 'admin@bicec.cm',
    name: 'Admin IT',
    role: AgentRole.ADMIN_IT,
    password: 'password123',
  },
};

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private useMock: boolean;

  constructor() {
    // Use mock mode if VITE_AUTH_MODE=mock or not in production
    this.useMock = import.meta.env.VITE_AUTH_MODE === 'mock' || 
                   import.meta.env.MODE !== 'production';
  }

  async login(email: string, password: string): Promise<LoginResponse | null> {
    if (this.useMock) {
      return this.mockLogin(email, password);
    }
    return this.apiLogin(email, password);
  }

  private async getMockCryptoKey(): Promise<CryptoKey> {
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(MOCK_STORAGE_ENCRYPTION_SECRET),
      const mockRefreshToken = `mock_refresh_${user.id}`;
      'PBKDF2',
      false,
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        refreshToken: mockRefreshToken,
        iterations: 100000,
        hash: 'SHA-256',
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  private async encryptForStorage(value: string): Promise<string> {
    const encoder = new TextEncoder();
    const key = await this.getMockCryptoKey();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      key,
      encoder.encode(value)
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const dataBase64 = btoa(String.fromCharCode(...new Uint8Array(encrypted)));
    return `${ivBase64}:${dataBase64}`;
  }

  private async decryptFromStorage(payload: string): Promise<string> {
    const [ivBase64, dataBase64] = payload.split(':');
    const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
    const data = Uint8Array.from(atob(dataBase64), c => c.charCodeAt(0));
    const key = await this.getMockCryptoKey();
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      key,
      data
    );
    return new TextDecoder().decode(decrypted);
  }

  private async mockLogin(email: string, password: string): Promise<LoginResponse | null> {
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const userWithPassword = MOCK_USERS[email.toLowerCase()];
    if (userWithPassword && userWithPassword.password === password) {
      const { password: _, ...user } = userWithPassword;
      const mockToken = `mock_token_${user.id}_${Date.now()}`;
      const mockRefresh = `mock_refresh_${user.id}`;
      const encryptedToken = await this.encryptForStorage(mockToken);
      const encryptedRefresh = await this.encryptForStorage(mockRefresh);
      const encryptedUser = await this.encryptForStorage(JSON.stringify(user));
      
      localStorage.setItem(TOKEN_KEY, encryptedToken);
      localStorage.setItem(REFRESH_KEY, encryptedRefresh);
      localStorage.setItem(USER_KEY, encryptedUser);
      
      return {
        user,
        accessToken: mockToken,
        refreshToken: mockRefresh,
      };
    }
    return null;
  }

  private async apiLogin(email: string, password: string): Promise<LoginResponse | null> {
    try {
      const res = await fetch(`${API_BASE}/auth/agent/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        return null;
      }

      const data = await res.json();
      
      // Store tokens
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(REFRESH_KEY, data.refresh_token);
      
      // Fetch user profile
      const userRes = await fetch(`${API_BASE}/auth/agent/me`, {
        headers: { 'Authorization': `Bearer ${data.access_token}` },
      });
      
      if (!userRes.ok) {
        return null;
      }
      
      const userData = await userRes.json();
      const user: User = {
        id: userData.id,
        email: userData.email,
        name: userData.name,
        role: userData.role as AgentRole,
        agencyId: userData.agency_id,
        isActive: userData.is_available,
      };
      
      localStorage.setItem(USER_KEY, JSON.stringify(user));
      
      return {
        user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (error) {
      console.error('API login failed:', error);
      return null;
    }
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
  }

  getStoredUser(): User | null {
    try {
      const stored = localStorage.getItem(USER_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (stored && token) {
        return JSON.parse(stored);
      }
    } catch {
      // ignore parse errors
    }
    return null;
  }

  getAuthHeader(): Record<string, string> {
    const token = localStorage.getItem(TOKEN_KEY);
    if (token) {
      return { 'Authorization': `Bearer ${token}` };
    }
    return {};
  }
}

export const authService = new AuthService();
