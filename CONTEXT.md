# Context — Ubiquitous Language

This is a glossary, not a spec. It pins the terms the code and docs must use
consistently. Implementation details live in `docs/adr/` and `docs/prd/`.

## Cost control

The bounded context that protects the owner's LLM budget on the public chat
endpoint. Its job: a request either gets served within budget, or it is refused
— spend must never exceed the configured ceilings.

- **Spend Ledger** — the authority that decides whether a chat request may spend
  money, and records what it spent. It is the single source of truth for every
  *dollar* limit. Accessed through one interface (a port) with swappable
  backends; the exact backend lives in a Durable Object. Not to be confused with
  the per-IP rate throttle, which is a fairness control, not a money authority.

- **Reservation** — a hold the Spend Ledger places against a ceiling at the
  moment a request is admitted, sized to the request's *worst-case* cost. A
  reservation makes in-flight, not-yet-spent money visible to concurrent
  requests, so the ceiling reflects money *committed* rather than only money
  already spent. Reservations expire on their own if never reconciled.

- **Reconciliation** — replacing a Reservation's worst-case estimate with the
  request's *actual* token cost once the response finishes: the difference is
  refunded (actual < reserved) or, rarely, topped up. After reconciliation the
  ledger reflects true spend.

- **Daily Circuit Breaker** — the global, all-visitors ceiling on spend (and on
  request count) for one UTC day. The master stop: when tripped, the site stops
  spending until the next day regardless of who is asking.

- **Monthly Provider Cap** — the per-provider ceiling on spend for one UTC month
  (e.g. Claude and OpenAI each have their own). A provider over its cap is
  skipped in the fallback order; when all are over, chat is unavailable.

- **Turnstile Gate** — the Cloudflare Turnstile proof-of-human check the chat
  endpoint requires before spending money. It removes scripted/automated
  traffic, which is what keeps a single human's worst case small.

- **Fail Closed** — when the Spend Ledger cannot be reached, a chat request is
  *refused* (production). The absence of a working money authority is treated as
  "no budget," never as "unlimited budget." (Development fails *open* via an
  in-memory ledger so local work needs no deployed authority.)
