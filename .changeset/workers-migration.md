---
type: patch
category: Upgrade Notes
---

Move the deploy from Cloudflare Pages to Cloudflare Workers

- The site now ships as a Worker with static assets (`main` + `assets` in `wrangler.jsonc`) instead of a Pages project. This is the ADR 0008 prerequisite: a Workers deploy can export Durable Object classes and run cron triggers, which upcoming apps need.
- Self-hosters redeploying from this version:
  - Deploy with `wrangler deploy` (or `pnpm deploy-cloudflare`); `wrangler pages deploy` no longer applies.
  - Bind KV in `wrangler.jsonc` — dashboard-only bindings are dropped by `wrangler deploy`. Create one with `wrangler kv namespace create KV` and put its id in `kv_namespaces`.
  - Re-set secrets on the Worker with `wrangler secret put` (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `TURNSTILE_SECRET` as applicable); Pages-scoped secrets do not carry over.
  - Move any custom domain from the Pages project to the Worker, then delete the Pages project.
  - Branch previews now come from Workers preview URLs (`preview_urls` is enabled) rather than `*.pages.dev` branch aliases.
