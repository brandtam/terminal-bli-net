---
name: verify
description: Build/launch/drive recipe for verifying Terminal OS changes in a real browser
---

# Verifying Terminal OS in the browser

## Launch

- `pnpm dev --port 5199` (background), wait for `curl http://localhost:5199/` → 200.
- Drive with claude-in-chrome. localStorage/IndexedDB persist across sessions on the same port, so previously installed apps stay installed.

## Coming-soon apps

Temp-flip the app's manifest `status: 'coming-soon'` → `'released'` in
`src/lib/terminalos/apps/manifests.ts` with a `// TEMP VERIFY FLIP` comment.
**Revert before commit.** Install path: Computer Store → buy → My Shelf → Install → /Applications.

## Gotchas (learned the hard way)

- **rAF stalls in a backgrounded Chrome window.** Baud-typing (and any rAF loop)
  doesn't advance during `wait` actions; a screenshot forces a frame and drains it.
  Send keys right after a screenshot, or drive via `javascript_tool` dispatching
  KeyboardEvents with sleeps in one call. (The Dialer routes keys as type-ahead —
  skip completes the screen and the key still acts — so stalled typing no longer
  eats input, but the stall itself still affects what screenshots show.)
- MCP round-trips run 15–30s — don't try to catch sub-second UI states with
  separate key/screenshot calls; use one `javascript_tool` call that dispatches
  events and samples `document.body.innerText` on a timer.
- Force rare dice (e.g. Dialer busy line, 7%) by overriding `Math.random` via
  `javascript_tool`; restore afterwards.
- Audio can't be heard by an agent — hook `AudioContext.prototype.create*` and
  `OscillatorNode.prototype.start` with counters to prove the graph is live.
- Console sweep: `read_console_messages` only records from its first call —
  call it once early, then drive, then read.
