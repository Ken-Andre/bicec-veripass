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
      'PBKDF2',
      false,
      ['deriveKey']
    );

    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: encoder.encode(MOCK_STORAGE_ENCRYPTION_SALT),
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
      const { password: _password, ...user } = userWithPassword;
      void _password; // Explicitly consume to satisfy strict linting
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

      if (!res.ok) return null;

      const data = await res.json();
      const encryptedToken = await this.encryptForStorage(data.access_token);
      const encryptedRefresh = await this.encryptForStorage(data.refresh_token);
      const encryptedUser = await this.encryptForStorage(JSON.stringify(data.user));

      localStorage.setItem(TOKEN_KEY, encryptedToken);
      localStorage.setItem(REFRESH_KEY, encryptedRefresh);
      localStorage.setItem(USER_KEY, encryptedUser);

      return {
        user: data.user,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
      };
    } catch (err) {
      console.error('API login error:', err);
      return null;
    }
  }

  async logout(): Promise<void> {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    window.location.href = '/login';
  }

  async getCurrentUser(): Promise<User | null> {
    const encryptedUser = localStorage.getItem(USER_KEY);
    if (!encryptedUser) return null;

    try {
      const userStr = await this.decryptFromStorage(encryptedUser);
      return JSON.parse(userStr);
    } catch (err) {
      console.error('Error getting current user:', err);
      return null;
    }
  }

  async getAccessToken(): Promise<string | null> {
    const encryptedToken = localStorage.getItem(TOKEN_KEY);
    if (!encryptedToken) return null;

    try {
      return await this.decryptFromStorage(encryptedToken);
    } catch (err) {
      console.error('Error getting access token:', err);
      return null;
    }
  }

  async refreshAccessToken(): Promise<string | null> {
    const encryptedRefresh = localStorage.getItem(REFRESH_KEY);
    if (!encryptedRefresh) return null;

    try {
      const refreshToken = await this.decryptFromStorage(encryptedRefresh);

      if (this.useMock) {
        const user = await this.getCurrentUser();
        if (!user) return null;
        const newToken = `mock_token_${user.id}_${Date.now()}`;
        const encryptedNewToken = await this.encryptForStorage(newToken);
        localStorage.setItem(TOKEN_KEY, encryptedNewToken);
        return newToken;
      }

      const res = await fetch(`${API_BASE}/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${refreshToken}`,
        },
      });

      if (!res.ok) {
        this.logout();
        return null;
      }

      const data = await res.json();
      const encryptedNewToken = await this.encryptForStorage(data.access_token);
      localStorage.setItem(TOKEN_KEY, encryptedNewToken);
      return data.access_token;
    } catch (err) {
      console.error('Error refreshing token:', err);
      this.logout();
      return null;
    }
  }

  isAuthenticated(): boolean {
    return !!localStorage.getItem(TOKEN_KEY);
  }
}

export const authService = new AuthService();
