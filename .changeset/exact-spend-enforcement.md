---
type: minor
category: Security
link: #69
---

Enforce exact LLM spend on the public chat endpoint behind a proof-of-human gate

- Add a Spend Ledger that makes every configured dollar ceiling exact: a request reserves its worst-case cost before streaming and reconciles to actual cost after, so concurrent requests can never overshoot a cap.
- Enforce the ceilings in a single global Durable Object (in the reminder Worker, reached over a `SPEND_LEDGER` service binding); the chat route depends only on the `SpendLedger` port, with an in-memory adapter for development.
- Fail closed in production: if the spend authority is unreachable, requests are refused rather than allowed to spend.
- Gate chat with Cloudflare Turnstile — verify a token on the first message of a session, then issue a 30-minute signed session token so later messages aren't re-challenged. The gate is config-activated (`PUBLIC_TURNSTILE_SITE_KEY` + the `TURNSTILE_SECRET` Pages secret) and fails open when unconfigured.
- Show a graceful in-voice "off the air" message when a daily or monthly ceiling is hit, instead of a raw error.
- Emit structured observability events for every ledger decision (reserve, commit, refund, expire, deny).
- Retire the superseded KV monthly-spend counters; the per-IP rate throttle and the model pricing table are unchanged.
