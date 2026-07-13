# App-owned API routes on a Workers deploy

Apps may own a server side. Their routes, queries, Durable Objects, and cron work live in app-named spaces with single-point registration, and the site moves from Cloudflare Pages to a Workers deploy so one artifact can carry all of it.

## Context

ADR 0004 made adding an app a manifest entry plus zero-prop components — zero OS edits — and ADR 0007 extended that to the store catalog. Every app so far is client-only, so the rule has never been tested against server code.

The Dialer (`docs/apps-exploration/dialer/prd.md`) is the first app with a server side: persistent boards in D1, dithered-image bodies in R2, a Durable Object per board for presence and node chat, and a nightly moderation cron. Nothing says where that code lives, how bindings are named, whether "installed" means anything to the server, or what happens when the API is unreachable.

The deploy platform forces the question. The site ships as Cloudflare Pages via `adapter-cloudflare`, and Pages output can neither export Durable Object classes nor run cron triggers — that is why the ReminderAgent already lives in a separate Worker (`terminal-reminder-agent`) reached through service bindings. Repeating that workaround per app would scatter every app's server side across companion Workers with their own deploys, secrets, and drift.

## Decision

**The site moves to a Workers deploy.** Same `adapter-cloudflare`, but `wrangler.jsonc` switches from `pages_build_output_dir` to a Workers config (`main` + `assets`). One deploy then carries SvelteKit routes, Durable Object classes, and cron triggers. The companion-Worker pattern stops being the norm; `terminal-reminder-agent` stays as-is for now and may fold in later.

**App server code lives in app-named spaces, mirroring the client rule:**

- Routes: `src/routes/api/<appId>/**` (`+server.ts` endpoints). The `<appId>` segment is the app's manifest id — ids are already readable kebab-case slugs (`dialer`, `computer-store`), so the URL is readable by construction and no separate api-slug mapping exists.
- Server logic: `src/lib/server/<appId>/` — queries, DO classes, cron handlers, moderation seams. Route files stay thin.
- Nothing app-specific in shared server code. No `if (app === 'dialer')` anywhere outside the app's own spaces.

**Registration is single-point, like `MANIFESTS` on the client.** An app with a server side may touch exactly three shared files, each with one additive, app-namespaced entry:

- `wrangler.jsonc` — bindings named `<APPID>_*` (`DIALER_DB`, `DIALER_FILES`), DO class names prefixed (`DialerBoardNode`).
- The DO export barrel — Workers requires DO classes exported from the entry module; one re-export line per class.
- The cron dispatch table — one `scheduled()` handler dispatches to per-app handlers; one entry per app.

**Install gates the client; server access control is app auth.** "Installed" is a fact in the browser's localStorage — the server has no way to verify it, so server logic must never gate on it: it would be trusting a client-supplied claim. Routes ship with the deploy and are technically reachable by anyone; what the server _can_ verify is credentials the app itself issues. The Dialer's chain is the pattern: install → open the app → claim a handle → receive a session token → the server accepts writes against that token, with rate limits per handle. Uninstalled users are shut out in practice because the only path to a credential is the app UI, but the enforced wall is the credential, not the install bit. Server data is shared world state — uninstalling the app deletes nothing server-side.

**Degradation is mandatory.** An app with a server side must define its behavior when the API is unreachable and must not soft-lock (the Dialer renders canon-only boards behind a `LOCAL MODE` banner). The server being down may shrink an app; it may not brick it.

## Consequences

The Pages → Workers migration is a prerequisite work item before the Dialer: wrangler config, deploy pipeline, and dashboard settings change, and self-hosters need Upgrade Notes in the changeset. Runtime behavior of existing routes (`/api/chat`, `/api/data`, `/api/subscribe`, `/api/dev`) should not change — that is the migration's acceptance test.

Adding a server-backed app is then: the manifest entry and components (ADR 0004), plus `src/routes/api/<appId>/`, `src/lib/server/<appId>/`, and one namespaced entry in each of the three registration points. Nothing else.

Guardrails extend to the server side:

- Every directory under `src/routes/api/` must be a manifest app id or on an explicit OS-route allowlist (`chat`, `data`, `dev`, `subscribe`), so an app cannot squat an unowned namespace and OS routes cannot silently multiply.
- Every binding in `wrangler.jsonc` beyond the OS set must carry an app-id prefix.

Local dev keeps working through miniflare, which emulates D1, R2, Durable Objects, and cron locally; an app's server side must be exercisable locally with no cloud resources.

_Amended 2026-07-12 (Dialer entry build):_ "exercisable with `pnpm dev`" was too strong. `pnpm dev` (getPlatformProxy) emulates D1/R2/KV but cannot host same-worker Durable Object classes, so under `pnpm dev` an app's DO-backed routes fail and the app must exercise its degraded path instead (the Dialer's LOCAL MODE). The full-stack local loop is `pnpm build && wrangler dev --test-scheduled`, which hosts DOs and cron in miniflare with no cloud resources. Both loops are part of the contract: `pnpm dev` proves degradation, `wrangler dev` proves the server side.
