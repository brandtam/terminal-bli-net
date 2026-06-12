# Exact spend enforcement via a Durable Object ledger

The public chat endpoint enforces every dollar ceiling through a single
authoritative Spend Ledger that reserves worst-case cost before a call and
reconciles to actual cost after, so configured caps cannot be exceeded.

## Context

The chat endpoint spends real LLM money on behalf of anonymous visitors. Spend
and rate limits were tracked in Cloudflare KV with read-modify-write counters
(`src/lib/server/spend.ts`). KV has no atomic increment and is eventually
consistent, which produces two failures for a money ceiling:

1. **Lost updates.** Concurrent requests read the same counter and overwrite
   each other, so recorded spend _undercounts_ real spend.
2. **Stale reads under burst.** A flood of requests within KV's propagation
   window all read a pre-cap value and all pass the gate.

The gate also recorded cost _after_ the stream finished, so N requests could
pass the check before any of them recorded — overshoot independent of the KV
weakness above. And `isProviderOverBudget` returned "available" when KV was
missing, i.e. it failed _open_: an infrastructure problem removed the cap.

The owner's requirement is explicit: the cap must be **exact**, not "probably
fine." A fuzzy guarantee was rejected. At the same time, this codebase is meant
to read as a reference example, so the design is held to a principal-engineer
bar: a clean seam, real tests on the invariant, and observability.

Cloudflare Pages cannot host Durable Objects (this is why `ReminderAgent`
already runs as a separate Worker bound over a `services` binding). So an exact,
serialized counter cannot live in the Pages app — it must live in a Worker the
Pages app calls.

Alternatives considered:

- **Keep KV, add a global daily backstop.** Cheaper, no new infrastructure, and
  with a Turnstile Gate in front the realistic overshoot is a few dollars. But
  the ceiling stays approximate (±a few dollars), which the owner explicitly
  rejected.
- **Per-IP sharded counters in many DO instances.** Scales better, but per-IP
  shards cannot enforce a single _global_ dollar ceiling without cross-shard
  aggregation — the opposite of what an exact global cap needs.
- **Single global DO counter (chosen).** Exact and simple, at the cost of a
  global serialization point.

## Decision

Introduce a **Spend Ledger** as the single authority for every dollar ceiling,
behind one port with two adapters.

**Port.** `SpendLedger` exposes `reserve`, `commit`/`refund` (reconcile), and
`status`. The chat route depends only on this interface.

**Adapters.**

- **`DurableObjectSpendLedger`** (production) — backed by one global Durable
  Object instance living in the existing `terminal-reminder-agent` Worker,
  reached from the Pages app over the `services` RPC binding. Its single-instance
  serialization is what makes counts exact.
- **`InMemorySpendLedger`** (development and tests) — no deployed dependency.

**Reserve-then-reconcile.** On admission the ledger debits the request's
worst-case cost (derived from conservative input tokens, `maxTokens`, cache-aware
input rates, and the model's output price) as a **Reservation**. If the route is
willing to fail over across providers, the reserve call creates one Reservation
per fallback candidate that also fits the daily and monthly ceilings; the route
streams only those reserved providers. When the stream finishes,
**Reconciliation** swaps each used estimate for actual cost and releases unused
fallback holds. Ceilings therefore reflect money _committed_, not only money
_spent_, which closes the check-before/record-after gap. The design deliberately
errs safe: when reservations fill a ceiling, requests are refused or fallbacks
are omitted even if actual spend would have fit. Overshoot is impossible;
occasional early refusal is accepted.

**Reservation expiry.** Each Reservation carries a short TTL (default 60s, well
above a 300-token stream). A request that dies after reserving but before
reconciling has its hold auto-refunded, so the ledger cannot drift upward from
orphaned holds.

**Scope split.** The ledger owns all _dollar_ ceilings — the global Daily
Circuit Breaker and the per-provider Monthly Provider Cap — exactly. Its daily
request backstop counts every ledger-adjudicated chat attempt, including
over-budget refusals, so a valid session cannot hammer the global Durable Object
for free after a dollar cap trips. The per-IP _rate_ throttle remains in KV: it
is a fairness control, not a money guarantee, and approximate counting there is
acceptable.

**Fail closed.** If the ledger is unreachable, production refuses the request
(no authority ⇒ no budget). Development uses the in-memory adapter, so it fails
open without special-casing.

**Turnstile.** A Turnstile Gate is required before the ledger is consulted, so
automated floods never reach the spend path. This is what keeps a single human's
worst case bounded and lets the per-IP throttle stay approximate.

## Consequences

- Configured caps become true ceilings: spend cannot exceed them under any
  concurrency. This is the property the owner required.
- A single global DO instance serializes every chat request through one RPC hop.
  At hobby traffic this is invisible; it would become a throughput bottleneck at
  serious scale, at which point the ledger would shard (e.g. time-bucketed
  instances) — a known, deferred evolution.
- The chat route gains a hard dependency on the ledger Worker. That dependency is
  the reason fail-closed and Reservation expiry are part of this decision, not
  afterthoughts.
- The `SpendLedger` port makes the money authority swappable and unit-testable
  without Workers. The load-bearing invariant — concurrent requests can never
  push committed spend past a ceiling — is covered by concurrency tests against
  the in-memory adapter, plus a Workers-pool test for the DO adapter.
- The ledger emits structured reserve/commit/refund/deny events so the cap can be
  observed working in production.
- KV remains for the per-IP rate throttle only. The old `spend.ts` dollar logic
  is superseded by the ledger; its pricing table (`MODEL_PRICING_USD_PER_MILLION`)
  is retained and reused for worst-case and actual cost.
