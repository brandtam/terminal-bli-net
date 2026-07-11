---
type: patch
category: Fixed
---

Retro polish: Firefox scrollbars, idle work, design-system docs

- Firefox now gets ink-on-paper scrollbars via `scrollbar-color` instead of default OS bars.
- The OS clock pauses its 1-second tick while the tab is hidden and resyncs the moment you return.
- The TV Guide stops its auto-scroll animation loop entirely while paused instead of idling on requestAnimationFrame.
- `docs/writing-an-app.md` gains a "Look and feel" section covering the brand tokens, typography, spacing, motion, and the PixelIcon system.
