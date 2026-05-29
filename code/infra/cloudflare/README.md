# Cloudflare demo/public access

This project exposes the customer-facing mobile PWA through a dedicated nginx
listener on `127.0.0.1:8081`.

That listener is intentionally onboarding-only:

- `/mobile/` is served.
- Mobile API modules are proxied: `/api/v1/auth`, `/api/v1/kyc`,
  `/api/v1/devices`, `/api/v1/banking`, `/api/v1/notifications`,
  `/api/v1/support`, and `/api/v1/sentry-proxy`.
- Back-office/admin/compliance surfaces return `404`: `/back-office`,
  `/backoffice`, `/flower`, `/api/v1/admin`, `/api/v1/backoffice`,
  `/api/v1/aml`, `/api/v1/analytics`, `/api/v1/audit`,
  `/api/v1/kyc/backoffice`.

## Quick demo tunnel

Use this for temporary demos when no Cloudflare account/domain is configured:

```powershell
docker compose -f code/docker-compose.yml --profile public-demo up -d cloudflared_quick
docker logs vp_cloudflared --tail 80
```

The logs contain a generated URL similar to:

```text
https://example-words.trycloudflare.com
```

Give testers:

```text
https://example-words.trycloudflare.com/mobile/
```

Quick Tunnel URLs are temporary and not guaranteed for production.

## Stable preprod tunnel

For a stable URL such as `onboarding.example.com`, create a named Cloudflare
Tunnel in Cloudflare Zero Trust and route the public hostname to:

```text
http://host.docker.internal:8081
```

Keep the back-office on a separate private route, for example Tailscale,
Cloudflare Access, or an internal BICEC network hostname.
