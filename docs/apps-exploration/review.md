# System review — before the six-app push

Reviewed July 2026 against the project's two promises: it should feel like a self-contained mid-to-late-1980s machine, and apps should be modular add-ons the OS knows nothing about. The core holds up well. The problems below are where the implementation contradicts one of those two promises, ordered by how much they matter for shipping six new apps.

## What holds

- The render/identity/launch path is genuinely manifest-driven. `matchWindow()` is a single funnel, window components are zero-prop and lazy-loaded, and `zero-os-edit.test.ts` proves a manifest-only app routes and renders with no OS edit.
- Blob-body garbage collection is real reachability-based GC with undo retention (ADR 0002).
- A shared design-token layer exists (`src/lib/themes/brand.css`), with themed window chrome and a shared `PixelIcon` sprite component enforced by conformance tests.
- Nothing polls the network in the background; idle network cost is zero.

## Major problems

### 1. No sound infrastructure at all
There is not one `AudioContext`, oscillator, or audio element in the codebase. For a system whose identity is the 8/16-bit graphics **and sound** era, the sonic half of the illusion is absent — no boot chime, no error beep, no shared beep/blip layer. Every new app (a tracker, games, a pet) would build WebAudio from scratch and none would sound like siblings. This is the single largest gap against the stated intent, and the cheapest to fix at the OS layer: one small `os.audio` module (a lazily-created context, a few era-correct voices, pause-on-blur) shared by all apps.

### 2. "Self-contained" depends on Google's CDN and archive.org
- `src/app.html:17-21` loads VT323 / Press Start 2P / Pixelify Sans from `fonts.googleapis.com`. Offline, the machine loses its typefaces — its whole face. Fonts should ship in the repo.
- The TV/VCR experience streams everything from archive.org (`src/lib/apps/vcr/vcr-media.ts:44,72`, iframe embeds in both VCR decks). Third-party uptime and licensing now sit inside the flagship feature.
- No service worker exists, so despite the "closing the tab loses nothing" pitch, an offline visit breaks fonts, TV, and chat. An 80s computer works with the phone line unplugged.

### 3. The modularity promise leaks at four edges
The documented contract is manifest + component + store-data. In practice:

- **Duplicate store catalog.** `src/lib/apps/computer-store/store-data.ts` re-declares every app (box art, taglines, categories) with hardcoded `appIds[]` arrays and closed category unions. It can silently drift from `manifests.ts`, and every new store app must be added in two places. It should derive from the manifest.
- **Closed icon set.** `PixelIcon.svelte` is an if-chain of ~11 glyphs with no fallback, and the conformance test rejects unknown kinds. Any app wanting its own icon edits an OS file. All six coming-soon games currently share `iconKind: 'doc'`. Icons need a registration path or a per-app sprite field in the manifest.
- **Dock/shell special cases.** `Desktop.svelte:350-371` hardcodes `chat:`, `Pricing.txt`, and `README.TXT` for dock indicators; `os-api.svelte.ts:177-183, 470-494` carries chat/TV-guide business rules (`DOCK_ALIASES`, `openChat`, on-air gating) inside the core OS API. New apps can't get equivalent behavior without editing the OS.
- **VCR geometry effect in the shell.** `Desktop.svelte:319-329` imports `vcrPrefs` and refits the VCR window on device change — app state wired app-by-app into Desktop.

### 4. The AppContext seams apps are told about don't exist
`os-context.ts` types `storage`, `capabilities`, and `lifecycle`, and the docs mention them, but `WindowHost.svelte:42-52` hands every window inert stubs. Real persistence is direct and unscoped — any app can read another app's files via `fs.findByApp('stickies')` or its localStorage keys. Either implement scoped storage or remove the seam from the contract; a half-promised sandbox is worse than none. This matters now because all six proposed apps persist state.

### 5. No game loop, no pause-on-blur, no close-cleanup enforcement
No shared tick/rAF lifecycle exists (`AppLifecycle.focusAware` is a reserved no-op), `visibilitychange` is never handled anywhere, and window teardown relies on each component remembering `onDestroy`. Four game stubs are already in the manifest and this round proposes more. Without an OS-owned loop + blur/close hooks, every game reinvents timing and any forgotten `onDestroy` leaks intervals and oscillators after the window closes — the tracker is the first app that would make that leak audible.

### 6. Touchscreen kids are locked out
`os-api.svelte.ts:76` treats any viewport under 720px as mobile, and `Desktop.svelte:377-393` replaces the entire OS with a "open this on a laptop" wall. The windowing code already uses pointer events, so tablets could work. If the target audience includes touchscreen-native kids, this gate contradicts it head-on — at minimum, landscape tablets should get in.

### 7. Disk-full is silent
`persistence.ts:74-78` catches localStorage quota errors and does nothing; `navigator.storage.estimate()` is never called; there is no capacity warning UI. A kid filling the disk with photo-booth shots or recordings would silently stop persisting and lose state on reload. An 80s machine said "disk full" — this one should too. (Related: Recorder records 60s clips while its manifest copy promises 10s, with no total-size cap.)

## Minor problems

- **Era drift is undecided.** The brief says mid-to-late 1980s; the chrome themes are System 7 and Win95 (1991–95) and the page meta says "mid-90s." Worth one explicit decision — the app concepts in this folder assume "late-80s spirit, early-90s chrome is acceptable."
- **Emoji icons break the pixel aesthetic.** Manifest `icon` strings (💾 🏪 💣 📜 🧮 🖌) render as full-color OS emoji in the Dock and Store next to hand-drawn pixel sprites — the docs even endorse it.
- **Firefox gets modern scrollbars.** `app.css` styles only `::-webkit-scrollbar`; no `scrollbar-width`/`scrollbar-color` fallback.
- **Docs never teach the design system.** `writing-an-app.md` covers wiring but not the palette, tokens, or typography rules; a new app author reverse-engineers `--brand-*` from other apps.
- **Idle work.** A 1s `setInterval` clock tick runs forever (`os-api.svelte.ts:123-131`) and TV Guide keeps a rAF loop alive even when paused.

## Recommended order before building the six apps

1. `os.audio` — shared WebAudio layer with pause-on-blur (unblocks tracker, pet, games, all UI sounds).
2. Self-host the fonts (one afternoon, removes the biggest offline break).
3. Derive `store-data` from manifests, or fold it in; add a PixelIcon fallback/registration path.
4. Implement or delete the `storage`/`lifecycle` context seams; if implemented, add the OS-owned close-cleanup hook games need.
5. Surface disk-full and add a capacity warning.
6. Decide the tablet/touch story.

Items 3–4 are the difference between "six apps in six clean PRs" and "six apps each smearing a little more app-specific code into the OS."
