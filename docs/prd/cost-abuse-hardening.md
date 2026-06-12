# Cost & Abuse Hardening PRD

## Problem Statement

The chat endpoint (`src/routes/api/chat/+server.ts`) calls paid LLM APIs on
behalf of anonymous visitors on a public site. A pre-public audit found that the
spend controls can be defeated: the Cloudflare KV counters that track spend and
rate are non-atomic and eventually consistent, cost is recorded only *after* a
stream completes, and the budget check fails *open* when KV is unavailable. With
no proof-of-human in front, a scripted client rotating IPs can drive the owner's
LLM bill well past the nominal $25-per-provider caps — a realistic worst case of
roughly $50–150+ in a bad month.

From the owner's perspective the requirement is simple and firm: configured
dollar ceilings must be **exact** — "shouldn't go too wrong" is not acceptable.
The site stays a free, anonymous hobby project (no accounts), and this subsystem
is to be built as a reference example of cost control on Cloudflare that other
engineers can replicate.

This risk exists on the **already-deployed** site today; it is not created by
open-sourcing the repo. It should be fixed regardless of repository visibility.

## Goals

1. Make every dollar ceiling a true ceiling that cannot be exceeded under any
   concurrency.
2. Remove the scripted-abuse vector with a proof-of-human gate.
3. Bound the worst possible day with a global circuit breaker.
4. Fail safe: an unreachable money authority denies spend, never permits it.
5. Ship it as reference-grade work: a clean port/adapter seam, an ADR, tests on
   the core invariant, and observability.

## Non-Goals

- No accounts, login, or per-user identity. The site stays anonymous.
- No per-IP *exact* limiting. The per-IP throttle stays approximate (KV); it is
  a fairness control, not a money guarantee.
- No horizontal sharding of the ledger. A single global instance is sufficient
  at current traffic; sharding is a documented future evolution, not now.
- No change to the chat product, personas, or streaming UX beyond the gate and
  the over-budget message.

## Solution

Introduce a **Spend Ledger** (see `CONTEXT.md`, `docs/adr/0005`): the single
authority for all dollar ceilings, consulted behind a proof-of-human gate.

1. **Turnstile Gate.** The chat endpoint requires a valid Cloudflare Turnstile
   token before any spend path runs. Automated floods never reach the ledger.
2. **`SpendLedger` port.** The chat route depends on one interface
   (`reserve` / `commit` / `refund` / `status`), not on storage. Two adapters:
   `DurableObjectSpendLedger` (production, exact) and `InMemorySpendLedger`
   (dev/tests).
3. **Exact dollar ceilings via one global Durable Object.** Hosted in the
   existing `terminal-reminder-agent` Worker, reached over the `services` RPC
   binding. Single-instance serialization makes counts exact.
4. **Reserve-then-reconcile.** Reserve worst-case cost on admission; reconcile to
   actual cost when the stream ends. Ceilings reflect committed money, so
   concurrent requests cannot overshoot. The bias is safe: refuse early rather
   than overspend.
5. **Reservation expiry.** Holds self-refund after a short TTL so orphaned
   reservations cannot lock the site out.
6. **Daily Circuit Breaker + Monthly Provider Cap** both enforced by the ledger.
7. **Per-IP rate throttle** stays in KV, unchanged in spirit (approximate).
8. **Fail closed in production, open in dev** (the in-memory adapter makes dev
   trivially open).
9. **Graceful over-budget response** in the app's voice.
10. **Observability**: structured reserve/commit/refund/deny events.

## Ceiling Values

All values are environment-configurable with these defaults.

| Control | Default | Authority | Notes |
|---|---|---|---|
| Global daily spend (Daily Circuit Breaker) | **$3 / UTC day** | Spend Ledger (exact) | Master breaker. Worst possible day. |
| Global daily request count | **5,000 / UTC day** | Spend Ledger (exact) | Dollar-independent backstop if pricing is ever wrong. |
| Monthly Provider Cap | **$25 / provider / UTC month** | Spend Ledger (exact) | Per provider (Claude, OpenAI). Total-budget backstop. |
| Per-IP rate | **30 / clock-hour** | KV (approximate) | Fairness throttle. Unchanged. |
| Per-request output tokens | **300** | request option | Already enforced; sets the worst-case reservation. |

## Domain Language

Defined in `CONTEXT.md`: Spend Ledger, Reservation, Reconciliation, Daily
Circuit Breaker, Monthly Provider Cap, Turnstile Gate, Fail Closed. Code, tests,
commits, and UI copy use these terms.

## Decisions (locked)

These were resolved in a design review and are settled:

1. Dollar ceilings must be **exact**, not approximate. (Rejected: KV + fuzzy
   backstop.)
2. Exactness is delivered by a **single global Durable Object** ledger.
   (Rejected: per-IP sharded DOs — cannot enforce a global cap.)
3. **Reserve-then-reconcile** is the mechanism; it errs safe (refuse early, never
   overshoot).
4. The ledger owns **all dollar ceilings** (global daily + per-provider monthly);
   the **per-IP rate throttle stays loose on KV**.
5. **Turnstile** is required on the chat endpoint.
6. **Production fails closed; development fails open** (in-memory adapter).
7. **Reservations self-expire** (default 60s TTL) to refund orphans.
8. Built behind a **`SpendLedger` port** with DO and in-memory adapters; covered
   by concurrency tests; emits observability events.
9. Ceiling values per the table above; all env-configurable.
10. **Turnstile cadence: first-message-per-session + session token.** Turnstile
    runs in managed/invisible mode and is validated on the first message of a
    session; on success the endpoint issues a short-lived signed session token
    (30 min) so subsequent messages are not re-challenged. Safe because, even if
    a token-holder scripts within their session, the exact Daily Circuit Breaker
    still stops all spend at the cap. (Rejected: challenge every message — more
    friction, marginal benefit once dollars are exact.)
11. **Over-budget UX: graceful in-voice SSE message.** When a ceiling is hit the
    endpoint returns a normal SSE message the chat window renders — the station
    is "off the air until tomorrow" (daily) or "this channel is dark this month"
    (monthly) — never a raw HTTP error. Keeps the retro-OS fiction intact.

## User Stories

1. As the site owner, I want configured dollar caps to be impossible to exceed,
   so that no concurrency pattern can run up my LLM bill past the ceiling.
2. As the site owner, I want a global daily spend breaker, so that the worst
   possible day is a number I chose, not an open-ended risk.
3. As the site owner, I want a request-count backstop independent of dollars, so
   that a wrong price constant cannot defeat the dollar cap silently.
4. As the site owner, I want automated traffic blocked by a proof-of-human gate,
   so that scripted abuse never reaches the spend path.
5. As the site owner, I want the system to refuse spend when the money authority
   is unreachable, so that an outage can never mean unlimited spend.
6. As a visitor, I want to chat normally after a quick, near-invisible human
   check, so that protection does not turn into friction.
7. As a visitor who arrives when a ceiling is hit, I want a clear in-character
   "off the air" message, so that the site feels intentional rather than broken.
8. As an engineer, I want the chat route to depend on a `SpendLedger` interface,
   so that the money authority is swappable and testable without Workers.
9. As an engineer, I want concurrency tests proving committed spend can never
   exceed a ceiling, so that the core guarantee is regression-protected.
10. As an operator, I want structured reserve/commit/refund/deny events, so that
    I can watch the cap working and diagnose refusals.
11. As a future maintainer, I want the design and its trade-offs recorded in an
    ADR and glossary, so that the global-chokepoint choice is not a mystery.

## Implementation Plan

Sequenced so each step is independently reviewable. Tracer-bullet first: a thin
end-to-end exact path before breadth.

1. **Ledger port + in-memory adapter.** Define `SpendLedger`
   (`reserve`/`commit`/`refund`/`status`), worst-case cost from `maxTokens` +
   pricing, Reservation type with TTL. Full unit + concurrency tests against the
   in-memory adapter (the invariant lives here).
2. **Wire the chat route to the port.** Replace the `spend.ts` dollar checks with
   reserve-before-stream / reconcile-after-stream against the injected ledger.
   Keep the KV per-IP throttle. In-memory adapter in dev.
3. **Durable Object adapter.** Implement the global-instance DO in
   `terminal-reminder-agent`; expose RPC; add the `services` binding consumption
   in the Pages app. Workers-pool test for the DO adapter.
4. **Fail-closed wiring.** Production refuses on ledger-unreachable; dev uses
   in-memory. Explicit test for the closed path.
5. **Turnstile Gate.** Add the widget to the chat UI; validate the token
   server-side before consulting the ledger; session-token issuance per the
   confirmed cadence.
6. **Daily Circuit Breaker + request-count backstop** in the ledger; over-budget
   in-voice response.
7. **Observability** events and a short dashboard/log note in `docs/`.
8. **Retire** the superseded dollar logic in `spend.ts`; leave pricing intact.

## Testing Decisions

- ★ **Invariant test (highest value):** fire many concurrent `reserve` calls at a
  near-full ceiling against the in-memory adapter; assert committed total never
  exceeds the cap and that over-cap calls are refused.
- **Reconciliation test:** reserved worst-case is replaced by actual; the
  difference is refunded; ledger reflects true spend.
- **Expiry test:** an un-reconciled reservation is refunded after its TTL.
- **Fail-closed test:** an unreachable ledger yields refusal in the prod path.
- **DO adapter test** via `@cloudflare/vitest-pool-workers` (already a dep).
- **Turnstile test:** missing/invalid token is rejected before any spend path.
- **Route test:** over-budget returns the graceful in-voice response, not a 500.

## Observability

The ledger emits one structured event per decision: `reserve`, `commit`,
`refund`, `expire`, `deny` — with ceiling name, amounts (reserved/actual),
remaining budget, and reason on denial. The reminder Worker already has
`observability.enabled`; reuse it.

## Out of Scope

- Accounts / identity / cross-device anything.
- Ledger sharding and high-scale throughput.
- Reworking the per-IP throttle to be exact.
- Any change to personas, schedule, or chat streaming beyond the gate and the
  over-budget message.

## References

- ADR: `docs/adr/0005-exact-spend-enforcement.md`
- Glossary: `CONTEXT.md` (Cost control)
- Current code: `src/lib/server/spend.ts`, `src/lib/server/llm.ts`,
  `src/routes/api/chat/+server.ts`
- Existing DO Worker pattern: `workers/reminder-agent/`,
  `src/lib/server/reminder-agent.ts`, root `wrangler.jsonc` (`services` binding)
