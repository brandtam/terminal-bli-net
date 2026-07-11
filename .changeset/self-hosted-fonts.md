---
type: patch
category: Fixed
---

Bundle all typefaces instead of loading them from Google Fonts

- VT323, Press Start 2P, Pixelify Sans, and Caveat now ship as self-hosted woff2 files under `/fonts/`, so the OS renders identically offline and no request leaves for `fonts.googleapis.com`.
- Dropped the Inter download entirely; nothing in the UI used it.
