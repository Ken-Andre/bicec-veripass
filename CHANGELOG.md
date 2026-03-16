# Changelog

## [0.1.7] - 2026-03-16

### Changed
- No code changes this week; no commits have landed after 2026-03-15 (last merge: PR [#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).

## [0.1.6] - 2026-03-15

### Added
- Backoffice SPA (React/Vite) with auth, RBAC routing, UI components, and Playwright/Vitest coverage for core flows ([#196](https://github.com/Ken-Andre/bicec-veripass/pull/196)).
- Mobile PWA skeleton with service worker registration and refreshed mobile build assets for offline readiness ([#194](https://github.com/Ken-Andre/bicec-veripass/pull/194)).
- Nginx reverse proxy and FastAPI backend bootstrap with TLS 1.3 and security headers to front the platform services ([#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).

### Fixed
- Hardened Nginx routing and `/health` headers, plus TLS and deployment configuration regressions ([#198](https://github.com/Ken-Andre/bicec-veripass/pull/198)).
- Resolved backoffice TypeScript errors and generator markup issues after the initial SPA build ([#196](https://github.com/Ken-Andre/bicec-veripass/pull/196)).
- Cleaned PWA service worker registration and removed unused mobile code to stabilize offline behavior ([#194](https://github.com/Ken-Andre/bicec-veripass/pull/194)).
