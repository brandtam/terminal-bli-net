---
type: minor
category: Added
---

The Dialer slice 2: live boards — real callers post next to the canon

- The Rusty Diskette's message boards are now a real, shared space. Claim a handle and password right on the board (period-correct interrogation, questionnaire included), read topics and threads served from D1, and post — new topics and replies — from an in-terminal line editor (`/S` saves, `/A` aborts). Canon posts are seeded rows in the same store, pinned and immutable, so authored fiction and real callers share one render path.
- Server side: `GET/POST /api/dialer/boards/[board]/topics` and `.../topics/[id]/posts`, a one-post-a-minute cooldown enforced per handle ("ONE POST A MINUTE. THE DRIVE IS OLD."), section validation against the locked board sections, and two D1 migrations — `0002` adds `topics.section` + a seed slug, `0003` seeds The Rusty Diskette's canon (generated from the content module and locked by a snapshot test). Self-hosters: run `wrangler d1 migrations apply dialer-db --remote` with the deploy.
- Sessions persist in AppData `progress.json` — hang up, call back tomorrow, and the board greets you by name. LOCAL MODE (server unreachable or kill switch) still browses full canon as GUEST and refuses posting in-fiction; a trunk probe races the modem handshake so the answer is ready by `CONNECT`.
