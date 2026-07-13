---
type: minor
category: Added
---

Dialer trunk line: the first app-owned server side (ADR 0008)

- The deployed Worker now boots from a hand-written entry (`src/worker/index.ts`) that wraps the SvelteKit worker and adds Durable Object exports and a cron dispatch table — the registration points every future server-backed app plugs into.
- New Dialer backend foundation: D1 schema + reserved canon handles (`migrations/dialer/0001_init.sql`), handle/password registration (Turnstile-gated) and login with brute-force lockout at `/api/dialer/auth/*`, bearer sessions (hashed at rest, 30-day sliding), a per-board `DialerBoardNode` Durable Object (presence, caller counter, BUSY at 8 callers), and a nightly cron that resets daily budgets and prunes expired sessions.
- A kill switch (`DIALER_FORCE_LOCAL` secret) turns every `/api/dialer/*` route into a 503 without a deploy; clients degrade to LOCAL MODE.
- The Dialer appears in the Computer Store as a COMING SOON box; the app itself ships separately.
- New guardrail test: every `src/routes/api/` directory must be a manifest app id or an allowlisted OS route.

### Upgrade Notes

Self-hosters redeploying this version need new Cloudflare resources and one config change:

1. `wrangler d1 create dialer-db` — paste the returned id into `d1_databases[].database_id` in `wrangler.jsonc`.
2. `wrangler d1 migrations apply dialer-db --remote` (and `--local` for dev).
3. `wrangler r2 bucket create dialer-files`.
4. The SvelteKit adapter now builds against `wrangler.adapter.jsonc`; deploys keep using `wrangler.jsonc`, whose `main` is `src/worker/index.ts`. No action if you deploy with `pnpm exec wrangler deploy` after `pnpm build`.
5. Full-stack local dev (Durable Objects + cron) is `pnpm build && wrangler dev --test-scheduled`; plain `pnpm dev` serves the site with `/api/dialer/*` answering 503 (LOCAL MODE).
