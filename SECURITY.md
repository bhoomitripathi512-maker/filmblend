# Security

Filmblend is a public, shareable-link app. Security focuses on abuse prevention, input validation, and keeping secrets off the client.

## Threat model

- **Public API routes** create blends, sync Letterboxd profiles, and compute recommendations.
- **No user accounts** — anyone with a blend link can connect a profile to an open slot.
- **Supabase** stores blend data. Server routes should use the service role key in production.

## Protections in this repo

| Layer | What it does |
|-------|----------------|
| `src/middleware.ts` | Validates blend slugs on API routes, applies rate limits per IP, sets security headers |
| `src/lib/api/security.ts` | Username/slug validation, bounded JSON bodies, production service-role check |
| `next.config.ts` | Global security headers on all responses |
| `.github/workflows/ci.yml` | Runs tests + build on every push/PR |
| `.cursor/rules/` | Agent guardrails against corrupting core blend/recommendation logic |

## Rate limits (per IP, rolling 1h window)

- Create blend: 24/hr
- Connect Letterboxd: 40/hr
- Compute results: 16/hr
- Read blend: 240/hr

## Production checklist

1. Set `SUPABASE_SERVICE_ROLE_KEY` on Vercel — **never** rely on the anon key in production.
2. Keep `TMDB_API_KEY` server-only (no `NEXT_PUBLIC_` prefix).
3. Do not commit `.env.local` or export zips containing env files.
4. Enable GitHub branch protection on `main` (require CI to pass before merge).

## Reporting issues

If you find a security problem, email the repo owner privately before opening a public issue.
