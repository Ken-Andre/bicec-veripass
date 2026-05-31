import { beforeEach, describe, expect, it } from 'vitest';
import { setViewportChromeColor } from './appChrome';

describe('setViewportChromeColor', () => {
  beforeEach(() => {
    document.head.innerHTML = '<meta name="theme-color" content="#000000">';
    document.documentElement.removeAttribute('style');
    document.body.removeAttribute('style');
  });

  it('updates the viewport background variables and theme meta tag', () => {
    setViewportChromeColor('#FBF8F3');

    expect(document.documentElement.style.getPropertyValue('--app-viewport-bg')).toBe('#FBF8F3');
    expect(document.body.style.backgroundColor).toBe('rgb(251, 248, 243)');
    expect(document.querySelector('meta[name="theme-color"]')?.getAttribute('content')).toBe(
      '#FBF8F3',
    );
  });

  it('does not throw when the theme-color meta tag is absent', () => {
    document.head.innerHTML = '';

    expect(() => setViewportChromeColor('#1A0F00')).not.toThrow();
    expect(document.documentElement.style.getPropertyValue('--app-viewport-bg')).toBe('#1A0F00');
    expect(document.body.style.backgroundColor).toBe('rgb(26, 15, 0)');
  });
});
