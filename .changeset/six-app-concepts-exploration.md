---
type: patch
category: Added
---

Add the six-app concept exploration pack under `docs/apps-exploration/`

- Six new app concepts, each with a build-ready PRD and a self-contained interactive HTML demo: GlyphDraw (ANSI art studio), MicroTracker (chiptune tracker), The Dialer (fictional dial-up BBS universe), Pixel Pal (desktop pet), Turtle Garden (LOGO turtle art toy), and 1-Bit Booth (dithered photo booth).
- A browsable `index.html` so a reviewer can click through every demo from disk, no build or network needed.
- A system review (`review.md`) capturing the major gaps found before the six-app push: no shared audio layer, CDN font and archive.org dependencies, store-catalog/icon modularity leaks, inert AppContext seams, missing game-loop infrastructure, the mobile lockout, and silent disk-full failures.
- Four concepts revised after hands-on review of the demos, with each PRD updated to match:
  - The Dialer graduates from offline fiction to a hybrid: canon boards seeded into a real community layer (D1 + R2 + Durable Objects), with handle/password identity, upload/download ratios, daily time limits, who's-online chat, the Autodialer exchange sweeper, and the Back Room hidden area.
  - Turtle Garden makes the program the artifact: an editable program pane beside the canvas, spells that load their source for editing, an adjustable pixel-size control, and period-correct flat phosphor rendering by default (neon glow becomes opt-in).
  - 1-Bit Booth gains eight film stocks, auto-exposure (AGC), an INVERT toggle, and an old-computing-aesthetic guardrail in the spec.
  - MicroTracker gets the full effect column (arpeggio, pitch slides, channel volume) with per-sub-column hex editing, per-channel level knobs with a dedicated gain stage, a mute that silences ringing notes, variable pattern length (16-1024 rows), BPM 60-240, and a bundled-songs plan with a gitignored seam for personal song data.
