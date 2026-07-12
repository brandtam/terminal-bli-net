# AppContext services: OS audio, window lifecycle, storage by convention

The storage and lifecycle seams on AppContext are now live handles, and the OS owns a shared synthesized audio layer at `os.audio`.

## Context

Every window has received the full `AppContext` shape since the manifest cutover, but two of its handles were inert stubs: `storage` exposed only `{ status: 'reserved' }`, and `lifecycle` was an empty typed seam. Apps were promised seams that did nothing.

Meanwhile the OS had zero audio infrastructure. Upcoming apps (tracker, games, desktop pet) would each reinvent WebAudio — its gesture-unlock dance, its master gain, its teardown — and none would sound like siblings. The OS itself was silent despite an 8/16-bit-era identity.

Nothing OS-owned caught leaked timers or oscillators on window close: cleanup relied entirely on each component remembering its own Svelte `onDestroy`, and no code anywhere handled `visibilitychange`, so a hidden tab kept running (and would have kept sounding).

## Decision

### Audio is OS-owned

`src/lib/os/audio.svelte.ts` is the one voice layer, exposed as `os.audio` (a readonly field on `OsApiClass`, so every window reaches it through the context it already has).

- One lazy `AudioContext`, created only after the first user gesture (a one-shot capture-phase pointerdown/keydown listener installed by `OsApiClass.init()`). Tones requested before that gesture are dropped silently.
- Era-correct voices, all synthesized — no audio assets: `beep(freq?, dur?)`, `blip()`, `error()` (a two-tone descending buzz), and the low-level `tone({ wave, freq, dur, gain })` with `square | pulse | triangle | noise` waves. Apps that share this vocabulary sound like siblings.
- One master gain with persisted mute/volume (`terminal.os.sound` via the persistence helpers). Muting is enforced in the layer, so no caller ever guards a sound call.
- The context suspends on `visibilitychange` when the tab hides and resumes on return. Sound never plays from a hidden tab.

The OS proves the layer with minimal touchpoints: alert dialogs play `error()` (progress alerts stay silent — they announce work, not a problem), and menu-bar picks play `blip()`.

### The lifecycle contract

`lifecycle` on AppContext is now real and tiny:

- `onCleanup(cb)` — OS-owned teardown. WindowHost creates one cleanup registry per window and runs it from _its own_ unmount, so a leaked interval or oscillator is caught even when the app component forgot its `onDestroy`. Callbacks run newest-first; a throwing callback never blocks the rest; registering after close runs immediately.
- `focused` — reactive; true while this window is the active window.
- `hidden` — reactive; mirrors `document.hidden` through the OS-started `pageVisibility` signal. Apps read it (in a `$derived`/`$effect`) for pause-on-blur behavior; the audio layer suspends on the same event, so a paused app is also a silent one.

### Storage by convention

`storage` on AppContext is a small working key-value handle: `get(key, fallback)` / `set(key, value)` / `delete(key)`, namespaced `terminal.app.<appId>.<key>` in localStorage through the existing `appRead`/`appWrite` helpers.

The namespace is a convention, explicitly NOT a sandbox: every app runs in the same page and can read any key it likes. The contract is tidiness — well-behaved apps never collide — and makes no security claim. Bulky bodies belong in the filesystem, not here.

### Still reserved

`capabilities` remains a typed documentation seam for a future iframe-sandbox capability list. Nothing enforces it today, and activating it is a separate decision — a real capability model changes the trust story, and pretending otherwise with a half-measure would be worse than the honest stub.

## Consequences

Apps stop reinventing infrastructure: sound is one import away and already gesture-safe, mute-aware, and hidden-tab-safe; per-app persistence is three methods with no key management; teardown has an OS-owned safety net.

The services are factories in `src/lib/os/app-services.ts` (storage handle, cleanup registry), unit-testable without mounting a component. The audio layer takes an injectable context factory, so its whole public surface is tested against a mock `AudioContext` in node.

The costs are small and accepted: alert/menu sounds add one call each to `showAlert` and the menu bar (behind the mute setting), and `AppLifecycle` changing from an empty seam to a required contract is a compile-time change only — no app had anything to read off the old shape.
