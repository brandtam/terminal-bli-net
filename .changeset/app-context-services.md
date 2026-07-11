---
type: minor
category: Added
---

Make the AppContext seams real: OS audio at `os.audio`, a working lifecycle handle, and per-app storage

- Add an OS-owned voice layer at `os.audio` — one shared, lazily-created AudioContext with era-correct synthesized voices (`beep`, `blip`, `error`, and a low-level `tone` supporting square/pulse/triangle/noise). It unlocks on the first user gesture, suspends whenever the tab is hidden, and honors one persisted OS-level mute/volume setting; no audio assets, and apps never guard a sound call.
- Alert dialogs now play the system error buzz and menu-bar picks a short blip, both behind the mute setting.
- Activate `lifecycle` on AppContext: `onCleanup(cb)` runs OS-owned teardown when a window closes (catching what components forget), and reactive `focused`/`hidden` let apps pause work on blur or when the tab hides.
- Activate `storage` on AppContext: a small per-app key-value handle (`get`/`set`/`delete`) namespaced `terminal.app.<appId>.<key>` in localStorage. Scoping is by convention, not a sandbox — no security claim. `capabilities` stays a reserved seam.
- Document the contracts in ADR 0006 and the "Writing an app" guide.
