const TOKEN_KEY = 'vp_token';

let inMemoryToken: string | null = null;

export function getAuthToken(): string | null {
  const sessionToken = sessionStorage.getItem(TOKEN_KEY);
  if (sessionToken) {
    inMemoryToken = sessionToken;
    return sessionToken;
  }

  const legacyToken = localStorage.getItem(TOKEN_KEY);
  if (legacyToken) {
    inMemoryToken = legacyToken;
    sessionStorage.setItem(TOKEN_KEY, legacyToken);
    localStorage.removeItem(TOKEN_KEY);
    return legacyToken;
  }

  inMemoryToken = null;
  return null;
}

export function setAuthToken(token: string): void {
  inMemoryToken = token;
  sessionStorage.setItem(TOKEN_KEY, token);
  localStorage.removeItem(TOKEN_KEY);
}

export function clearAuthToken(): void {
  inMemoryToken = null;
  sessionStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(TOKEN_KEY);
}
