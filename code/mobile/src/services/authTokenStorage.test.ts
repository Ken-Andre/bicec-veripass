import { beforeEach, describe, expect, it } from 'vitest';
import { clearAuthToken, getAuthToken, setAuthToken } from './authTokenStorage';

describe('authTokenStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    clearAuthToken();
  });

  it('stores new auth tokens in session storage only', () => {
    setAuthToken('session-token');

    expect(getAuthToken()).toBe('session-token');
    expect(sessionStorage.getItem('vp_token')).toBe('session-token');
    expect(localStorage.getItem('vp_token')).toBeNull();
  });

  it('migrates a legacy local storage token into session storage', () => {
    localStorage.setItem('vp_token', 'legacy-token');

    expect(getAuthToken()).toBe('legacy-token');
    expect(sessionStorage.getItem('vp_token')).toBe('legacy-token');
    expect(localStorage.getItem('vp_token')).toBeNull();
  });

  it('clears auth tokens from both browser stores', () => {
    sessionStorage.setItem('vp_token', 'session-token');
    localStorage.setItem('vp_token', 'legacy-token');

    clearAuthToken();

    expect(getAuthToken()).toBeNull();
    expect(sessionStorage.getItem('vp_token')).toBeNull();
    expect(localStorage.getItem('vp_token')).toBeNull();
  });
});
