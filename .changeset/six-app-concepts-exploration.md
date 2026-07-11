---
type: patch
category: Docs
---

Add the six-app concept exploration pack under `docs/apps-exploration/`

- Six new app concepts, each with a build-ready PRD and a self-contained interactive HTML demo: GlyphDraw (ANSI art studio), MicroTracker (chiptune tracker), The Dialer (fictional dial-up BBS universe), Pixel Pal (desktop pet), Turtle Garden (LOGO turtle art toy), and 1-Bit Booth (dithered photo booth).
- A browsable `index.html` so a reviewer can click through every demo from disk, no build or network needed.
- A system review (`review.md`) capturing the major gaps found before the six-app push: no shared audio layer, CDN font and archive.org dependencies, store-catalog/icon modularity leaks, inert AppContext seams, missing game-loop infrastructure, the mobile lockout, and silent disk-full failures.
