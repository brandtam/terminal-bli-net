# MicroTracker — PRD

A 4-channel chiptune tracker for TerminalOS, in the spirit of Ultimate Soundtracker (1987) and FastTracker. Vertical pattern grid, hex row numbers, keyboard piano, WebAudio synthesis. Songs are module files on Terminal HD; double-clicking a module opens it in MicroTracker.

This document is complete enough to build the app in this repo without follow-up questions. Read `docs/writing-an-app.md` first; the manifest sketch below follows that contract exactly.

---

## 1. Overview & audience

MicroTracker is a music tracker: a spreadsheet where time runs downward. Each row is a tick of the song, each column is a voice. You place notes with the keyboard, press play, and the rows scroll past a fixed playhead while four synthesized voices perform the pattern.

Four fixed channels, classic 8-bit voicing, all synthesized with WebAudio — no samples, no audio files, no network:

| Ch | Voice    | Typical use          |
| -- | -------- | -------------------- |
| 1  | Pulse A  | Lead melody          |
| 2  | Pulse B  | Harmony / arpeggio   |
| 3  | Triangle | Bass                 |
| 4  | Noise    | Drums (kick/snare/hat) |

Audience: retro computing enthusiasts — people who remember (or wish they remembered) ProTracker on an Amiga 500. They want the ritual: hex rows, monospace grid, the pattern scrolling under the playbar. Secondary audience: anyone who screen-records the demo song and posts it.

Not a DAW. No mixing console, no automation lanes, no MIDI. One pattern grid, four voices, a handful of effects.

## 2. Viral hook

Two things make this spread:

1. **Demo mode.** A bundled, genuinely good chiptune (minor key, ~140 BPM, driving bass, arpeggiated harmony, noise drums). One click on "Play Demo Song" — from the File menu, or from the big button shown in the empty launch window — loads it and plays from row 0. The scrolling pattern grid with per-channel VU flashes is the money shot for a screen recording. Zero setup: launch app, one click, music.
2. **Tiny shareable songs.** A full song is a compact JSON module of a few KB. It lives as a file on Terminal HD, so it participates in everything files already do here: it sits on the Desktop, gets renamed in Finder, survives in backups, and double-clicking it opens the tracker on that song. When Terminal HD grows sharing/export, modules come along for free because they are just files with a content type.

## 3. UX walkthrough

**First launch.** User buys MicroTracker in the Computer Store (ENT shelf), installs from My Shelf, double-clicks `MicroTracker.app`. The launch window (`microtracker`) opens with an empty 64-row pattern and an empty-state overlay: app name, one-line description, and two buttons — "▶ Play Demo Song" and "New Module". The status line at the bottom shows the key legend.

**Entering notes.** Click a cell (or arrow-key to it). The cursor cell is highlighted. Pressing a piano key places a note at the cursor and advances the cursor one row (edit-step 1):

- `Z S X D C V G B H N J M` → C, C#, D, D#, E, F, F#, G, G#, A, A#, B at the base octave.
- `Q 2 W 3 E R 5 T 6 Y 7 U` → the same twelve semitones one octave up; `I 9 O 0 P` continue into the next octave (C–E).
- `[` / `]` lower / raise the base octave (default 4, range 1–6).
- On the noise channel, pitch class maps to drum: C–E → kick, F–G# → snare, A–B → hat. The cell renders `KCK` / `SNR` / `HAT` instead of a note name.
- `Delete` / `Backspace` clears the cell.
- In the volume column, `0–9 A–F` type a hex volume; `+` / `-` nudge it.
- In the effect columns, hex keys type the effect number and parameter (see §5).

Every placed note previews immediately through its channel voice (a keydown is a user gesture, so the AudioContext may start here).

**Playing.** `Space` toggles play/stop (also a Playback menu item and a transport button). Playback starts at row 0. The playhead is a fixed bright bar in the vertical center of the grid; rows scroll beneath it. Channel headers carry VU meters that kick on each note trigger and decay. Tempo is a BPM field in the transport bar; changes apply on the next scheduled row.

**Saving.** `⌘S` (File → Save). First save prompts for a name (default `untitled.mtk`) and writes a module file to `/Documents`. Subsequent saves overwrite the same file's body. The window title shows the file name, with a `•` dirty marker when there are unsaved edits. Closing a dirty window asks save / discard / cancel via `os` alert.

**Reopening.** In Finder, the module file shows as a document owned by MicroTracker. Double-click routes through `os.openDocument` → the `opens` declaration on the prefix window → a `microtracker:<fileId>` window is minted, the component reads `window.args.fileId`, loads the body, deserializes, and the pattern is back exactly as saved, cursor at row 0. Opening the same file twice focuses the existing window (standard prefix-window behavior). Multiple different modules can be open at once; each window owns its own audio engine.

**Closing.** Closing the window stops playback and releases all audio immediately (see §7, hard requirement).

## 4. Feature list — v1

In scope:

- One pattern, 64 rows, 4 fixed channels. Cell = note + volume (hex 0–F) + effect (1 hex digit) + effect param (2 hex digits).
- Keyboard piano entry (two-row layout above), base octave switch, cell clear, edit-step of 1.
- Arrow-key navigation across rows, channels, and sub-columns (note / vol / fx / param). `Tab` jumps a whole channel.
- Play/stop from row 0, loop at row 63 → 0. Fixed playhead, scrolling grid, per-channel VU meters, per-channel mute (click the channel header).
- Tempo: BPM 60–240, rows-per-beat fixed at 4 (each row is a 16th note).
- Effects (per §5): `0xy` arpeggio, `1xx` slide up, `2xx` slide down, `Cxx` set channel volume.
- Bundled demo song + "Play Demo Song" (empty-state button and File menu item).
- Save / open module files on Terminal HD (format in §8).
- New Module (⌘N) resets to an empty pattern in the current window if saved/clean, else prompts.

Explicit scope cuts (v2+):

- **More effects** — vibrato, portamento-to-note, pattern break, position jump, retrigger.
- **WAV export** — offline render via `OfflineAudioContext`; deliberately deferred, the module file is the shareable artifact for v1.
- **More channels / channel config** — 4 fixed voices only; no duty-cycle column, no extra pulse channels.
- Multiple patterns and an order list (v1 module format already reserves the fields so v2 doesn't break compatibility, but the UI edits exactly one pattern).
- Sample support of any kind. Never in scope; the identity of the app is pure synthesis.
- Copy/paste blocks, undo. (Undo is desirable but cut for v1; note it in Risks.)
- Import of real MOD/XM files.

## 5. Audio architecture

All audio lives in a `TrackerEngine` class (plain TS, no Svelte), one instance per open window, created lazily on the first user gesture that needs sound.

### Voice graph

One `AudioContext` per engine. Persistent per-channel nodes — voices are *retriggered*, never rebuilt, so there is no per-note node churn and no click management beyond envelopes:

```
Pulse A:  OscillatorNode (PeriodicWave, 50% duty) ─→ GainNode ─┐
Pulse B:  OscillatorNode (PeriodicWave, 25% duty) ─→ GainNode ─┤
Triangle: OscillatorNode (type 'triangle')        ─→ GainNode ─┼─→ master GainNode ─→ DynamicsCompressorNode ─→ destination
Noise:    AudioBufferSourceNode (1 s white noise, ─→ GainNode ─┘
          loop: true, playbackRate automated)
```

- Pulse waves come from `createPeriodicWave(real, imag)` with 32 harmonics, `imag[n] = (2 / (nπ)) · sin(πnd)` for duty `d` (0.5 and 0.25). PeriodicWave is band-limited by the implementation, so no aliasing work needed.
- Noise is one shared 1-second `Float32Array` of `Math.random()*2-1`, wrapped in a looping buffer source started once. Drum types are shaped by `playbackRate` + envelope: kick = rate swept 0.8 → 0.12 over 60 ms with a ~55 ms gain decay; snare = rate 0.95, ~70 ms decay; hat = rate 2.5, ~20 ms decay.
- Per-channel gain doubles as the envelope. Note trigger at time `t`:
  `gain.cancelScheduledValues(t); gain.setValueAtTime(0, t); gain.linearRampToValueAtTime(a, t + 0.004); gain.setTargetAtTime(a · sustain, t + 0.03, τ)` where `a = (vol/15) · channelBase`. Lead sustains (`sustain ≈ 0.45`, τ ≈ 0.18 — held notes ring until the next trigger); arp and bass decay to 0 (τ ≈ 0.07 / 0.13). Channel base gains ≈ 0.20 / 0.12 / 0.32 / 0.25; master ≈ 0.85 into the compressor.
- Pitch: `freq = 440 · 2^((n − 57) / 12)` with `n` the semitone index, `n = 57` = A-4. Set with `osc.frequency.setValueAtTime(freq, t)`.
- Mute = skip the channel in `scheduleRow` (not a gain hack, so unmuting doesn't resurrect a stale envelope).

### Scheduler

Standard lookahead scheduler (the "two clocks" pattern):

- A `setInterval` timer fires every **25 ms**. Each tick, it schedules every row whose start time falls within the next **120 ms** (`while (nextRowTime < ctx.currentTime + 0.12)`), using exact `AudioContext.currentTime`-domain timestamps. All `setValueAtTime`/ramp calls are therefore sample-accurate; the JS timer only has to wake up *at all* within 120 ms, so tab-throttling headroom is comfortable and there is zero cumulative drift — `nextRowTime += rowDuration` accumulates in the audio clock domain, never from `Date.now()`.
- `scheduleRow(row, t)` triggers each unmuted channel's cell (if any), applies effects (below), and pushes UI events (`{t, row}` for the playhead, `{t, ch, level}` per trigger) onto a queue.
- A `requestAnimationFrame` loop drains UI events whose `t ≤ ctx.currentTime`, moving the playhead row, flashing channels, and decaying VU meters. UI follows audio; audio never waits for UI.
- Play: `ctx.resume()`, `row = 0`, `nextRowTime = ctx.currentTime + 0.08`, start interval. Stop: clear interval, `cancelScheduledValues(now)` + `setTargetAtTime(0, now, 0.03)` on every channel gain, flush the UI queue.

### Tempo math

`rowDuration = 60 / (bpm × rowsPerBeat)` seconds. Rows-per-beat is fixed at 4 (a row is a 16th note). At 140 BPM: `60 / 560 ≈ 107.14 ms` per row; one 64-row pattern = 4 bars of 4/4 ≈ 6.86 s. BPM changes take effect on the next `nextRowTime += rowDuration` accumulation — no reset, no glitch.

### Effects (evaluated in `scheduleRow`)

Effects are scheduled entirely inside the row's time window using the same audio-clock timestamps:

- `0xy` **arpeggio** — retune the oscillator to base, base+x, base+y semitones at `t`, `t + rowDuration/3`, `t + 2·rowDuration/3` (`setValueAtTime` ×3). With no note in the cell, applies to the channel's last note.
- `1xx` **slide up** / `2xx` **slide down** — `frequency.exponentialRampToValueAtTime(f · 2^(±xx/12 · 1/16), t + rowDuration)` from the current frequency; `xx` is sixteenths of a semitone per row, so slides chain across rows like classic trackers.
- `Cxx` **set volume** — override the channel's running volume (`xx` clamped to 0–3F, scaled to the 0–15 range) starting this row; a cell's own volume digit still wins for its row.
- Effects on the noise channel: only `Cxx` applies; pitch effects are ignored.

## 6. Visual spec

Era target: FastTracker II / ProTracker on a sharp dark CRT — not the OS's paper-and-ink desktop chrome. The window frame is standard TerminalOS chrome; everything inside the content area is tracker-dark. That contrast is intentional and reads as "a pro tool from a different subculture," exactly like DPaint or FT2 felt next to Workbench.

- **Palette** (inside the content area): background `#0b0d12`; panel/toolbar `#131722`; grid lines `#1c2230`; row numbers cyan `#5ad7e0`; note text warm off-white `#e8e6d0`; empty cells dim `#3a4254` (rendered as `···`); volume digits amber `#ffb347`; effect digits `#9a8cff`; playhead bar `#233551` with full-bright text; beat rows (every 4) faintly lifted `#11141d`; bar rows (every 16) `#151a26`; VU fill green→amber gradient; record/danger accents `#ff5d5d`.
- **Layout**: transport bar on top (play/stop, BPM spinner, octave indicator, module name); channel header strip (channel number, voice name, VU meter, mute state); the pattern grid filling the rest, playhead bar fixed at vertical center with rows translating beneath it; one-line status/legend footer.
- **Typography**: the OS monospace stack only (`ui-monospace, Menlo, Consolas, monospace`) — no webfonts, nothing fetched. Grid at ~13 px, tabular figures via monospace, uppercase everywhere in chrome. Row numbers and row indices in **hex** (`00`–`3F`).
- **Cell format**: `A-4 C 0xy` — three-char note (`C#5`, `···` when empty), one hex volume digit, three hex effect digits. Noise channel renders `KCK`/`SNR`/`HAT` in the note slot.
- Default window 640×480 (min 560×400). The grid shows ~16 rows; everything else is fixed-height.

## 7. TerminalOS integration spec

### Manifest (`src/lib/terminalos/apps/manifests.ts`)

```ts
defineApp({
	id: 'microtracker',
	name: 'MicroTracker',
	fileName: 'MicroTracker.app',
	category: 'entertainment',
	description: '4-channel chiptune tracker',
	icon: '♪',
	removable: true,
	desktopAliasByDefault: false,
	isSystem: false,
	status: 'released',
	iconKind: 'floppy',
	windows: [
		{
			// Launch window: empty pattern + demo-song empty state. No `opens` here —
			// a launch window that claims a type steals document routing.
			match: { kind: 'exact', id: 'microtracker' },
			role: 'app',
			title: () => 'MicroTracker',
			size: () => ({ w: 640, h: 480, minW: 560, minH: 400 }),
			component: () => import('$lib/apps/microtracker/MicroTrackerWindow.svelte')
		},
		{
			// One minted window per module document.
			match: { kind: 'prefix', prefix: 'microtracker:', arg: 'fileId' },
			role: 'app',
			title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'MicroTracker',
			size: () => ({ w: 640, h: 480, minW: 560, minH: 400 }),
			component: () => import('$lib/apps/microtracker/MicroTrackerWindow.svelte'),
			opens: { contentTypes: ['application/x-microtracker-module'] }
		}
	],
	aboutSpec: {
		title: 'MicroTracker',
		version: 'v1.0',
		tagline: 'four channels of pure chip',
		glyph: '♪',
		glyphBg: 'var(--ink)',
		glyphFg: 'var(--paper)',
		sections: [
			{
				h: 'WHAT IT IS',
				body: 'A four-channel chiptune tracker. Two pulse voices, one triangle, one noise — all synthesized, no samples. Songs save as tiny module files on Terminal HD.'
			},
			{
				h: 'HOW TO USE IT',
				body: 'The keyboard is a piano: Z–M is the low octave, Q–P the high one. Arrows move the cursor. Space plays. File → Play Demo Song if you just want to hear it go.'
			}
		]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [
				{ type: 'action', label: 'New Module', shortcut: '⌘N', action: () => os.launchApp('microtracker') },
				{ type: 'action', label: 'Save', shortcut: '⌘S', action: () => { /* focused window save, via a module-level command bus (see component notes) */ } },
				{ type: 'action', label: 'Play Demo Song', action: () => { /* same command bus */ } },
				{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
			]
		},
		{
			label: 'Playback',
			items: [
				{ type: 'action', label: 'Play / Stop', shortcut: 'Space', action: () => { /* command bus */ } }
			]
		},
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About MicroTracker', action: () => os.openAbout('microtracker') }]
		}
	],
	statusExtra: () => null
});
```

Menu-to-window commands: `menus(os)` has no window handle, so window-scoped actions (Save, Play/Stop, Play Demo) go through a small module store in `$lib/apps/microtracker/commands.ts` — the focused window's component registers handlers on mount and unregisters on destroy. Follow whatever pattern the existing document apps (TextEdit) use for their Save menu item; do not invent a second mechanism if one exists.

Both window specs point at the same component; it branches on `window.args.fileId` being present (document mode) vs absent (scratch mode). One component, zero props, per the app contract.

### Store entry (`src/lib/apps/computer-store/store-data.ts`)

Add to `APPS`:

```ts
{
	id: 'microtracker',
	cat: 'ENT',
	title: 'MICROTRACKER',
	pub: 'CHIP DIVISION',
	tagline: 'Four channels. No samples.',
	icon: 'cb', // reuse; a dedicated 'tracker' box glyph in computer-store/PixelIcon.svelte is a nice-to-have
	sticker: 'NEW',
	back: 'A music tracker. Time runs downward, notes go in cells, and four synthesized voices — two pulse, one triangle, one noise — play whatever you type. Comes with a demo song so you can hear what it sounds like before you learn what a hex number is.',
	inside: ['4 channels', '64-row patterns', 'Arpeggio, slides, volume', 'One very good demo song'],
	reqs: 'Terminal OS 1.0 · Speakers'
}
```

and `'microtracker'` to `CATEGORIES.ent.appIds`.

### Files & source layout

```
src/lib/apps/microtracker/
  MicroTrackerWindow.svelte   // the one window component (grid, transport, keyboard)
  engine.ts                   // TrackerEngine: AudioContext, voices, scheduler (no Svelte imports)
  pattern.ts                  // pattern model + module (de)serialization + validation
  demo-song.ts                // the bundled demo module as a const
  commands.ts                 // menu → focused-window command bus
  pattern.test.ts, engine.test.ts
```

### Persistence plan

**Decision: modules are compact JSON, stored as a UTF-8 blob body in IndexedDB (`fs.createBlobFile`), with `contentType: 'application/x-microtracker-module'`. Not an inline-text body.**

Rationale, given the localStorage-manifest / IndexedDB-blob split:

1. **Content-type routing requires a blob body.** `contentType` lives on the `indexeddb-blob` `BodyRef` (`filesystem/types.ts`) — an `inline-text` body has nowhere to carry it. The prefix window's `opens: { contentTypes: [...] }` claim is the LaunchServices-correct way to own the format, and it keeps working even if `opensWith` is ever stripped or the file was made by something else. An inline-text module would have to lean entirely on `opensWith`, and its `fileType` fallback would be the meaningless catch-all `'data'` (the closed `FileType` union has no `'module'`, and claiming `fileTypes: ['data']` would steal every data file).
2. **The manifest is the scarce resource.** Every inline-text byte lives inside the localStorage manifest and is rewritten on every debounced persist of *anything*. Modules are small (2–10 KB) but users who like a tracker make dozens of them; song bodies are exactly the "bulk file bodies" the IndexedDB side of the split exists for. The manifest keeps only the ~200-byte node record.
3. Blob bodies already have working GC, backup, and quota paths (`body-gc`, `backup.ts`) — recordings prove the route.

Concrete calls:

- **Create**: `fs.createBlobFile(DOCUMENTS_ID, name, new TextEncoder().encode(json).buffer, { appId: 'microtracker', fileType: 'data', contentType: 'application/x-microtracker-module' })`.
- **Save over**: `fs.replaceBlobFileBody(fileId, bytes)` (contentType is preserved).
- **Load**: `file.bodyRef.kind === 'indexeddb-blob'` → `fs.readBody(bodyRef.bodyId)` → `TextDecoder` → `JSON.parse` → validate (§8). Any failure shows a "not a MicroTracker module / damaged file" alert and closes to scratch mode; never a blank crash.
- File extension `.mtk` by convention; routing never depends on it.

### Module format (`fmt: 'mtk1'`)

```jsonc
{
	"fmt": "mtk1",
	"title": "untitled",
	"bpm": 140,
	"rowsPerBeat": 4,        // fixed 4 in v1; field exists so v2 can vary it
	"order": [0],            // v1 always [0]; reserved for multi-pattern v2
	"patterns": [
		{
			"rows": 64,
			"channels": [      // exactly 4, in voice order
				[[0, 57, 12, 0, 0], [2, 60, 12, 0, 0]],  // sparse: [row, note, vol, fx, fxParam]
				[], [], []
			]
		}
	]
}
```

`note` is the semitone index (0 = C-0, 57 = A-4), `vol` 0–15, `fx` 0–15, `fxParam` 0–255. Sparse per-channel event lists keep typical songs at 2–10 KB. Validation: check `fmt`, clamp all numeric ranges, reject wrong channel count. Unknown extra fields are ignored (forward compatibility).

### Window close stops audio — hard requirement

The engine's lifetime is the component's lifetime. `MicroTrackerWindow.svelte` tears down in `onDestroy` (or the root `$effect` teardown): `engine.stop()` then `engine.dispose()` — which clears the scheduler interval, cancels all scheduled params, disconnects nodes, and calls `AudioContext.close()`. No engine or context may live in module scope. Closing the window, quitting the app, or navigating away must leave zero sound and zero running timers within one frame. This is testable: `engine.dispose()` is a plain method; the component test asserts it is called on destroy.

## 8. Acceptance criteria

Every item is checkable by hand or by test:

- [ ] App appears in the Computer Store ENT shelf; buy → install → `MicroTracker.app` in `/Applications`; double-click opens the launch window.
- [ ] Launch window shows the empty state with "Play Demo Song" and "New Module"; clicking Play Demo Song starts audible playback within 250 ms and the grid scrolls under a fixed playhead.
- [ ] All four voices are audible and distinct (two pulse timbres, triangle bass, noise drums); no clicks/pops on note boundaries at default volume.
- [ ] Playback timing: after 2 minutes of looping at 140 BPM, the audible row rate has not drifted (scheduler times accumulate in the audio clock; verify by ear against a metronome or by asserting `nextRowTime` math in a unit test).
- [ ] Clicking a cell selects it; arrow keys move across rows/channels/sub-columns; the Z-row and Q-row piano keys place the expected notes; `[`/`]` change octave; Delete clears; entering a note previews it audibly.
- [ ] Effects behave per §5: `037` arpeggiates a minor chord audibly; `1xx`/`2xx` bend pitch; `Cxx` changes channel volume from that row on.
- [ ] BPM change during playback takes effect within one row and does not glitch or reset the position.
- [ ] Mute toggles per channel take effect on the next row.
- [ ] ⌘S on a scratch window creates a `.mtk` file in `/Documents` with a blob body and `contentType: 'application/x-microtracker-module'`; the window title becomes the file name; a second ⌘S replaces the body (no duplicate files).
- [ ] Double-clicking the saved file in Finder opens a `microtracker:<fileId>` window with the identical pattern (round-trip equality on the serialized form). Double-clicking again focuses the existing window.
- [ ] A corrupted module body (hand-edited garbage) produces the damaged-file alert, not a crash.
- [ ] Closing the window mid-playback silences audio immediately and leaves no running interval (assert `dispose()` called; manually: play, close, hear nothing).
- [ ] Closing a dirty window prompts save / discard / cancel.
- [ ] `pnpm check`, `pnpm test:unit` pass, including `app-conformance.test.ts` and `zero-os-edit.test.ts`, with zero edits under OS code paths.

## 9. Test plan

- **`app-conformance.test.ts`** (existing, no changes needed): the new manifest entry must pass — windows route back to the app, components load, ids unique, `iconKind: 'floppy'` is a real glyph, only one window claims `application/x-microtracker-module`.
- **`zero-os-edit.test.ts`** (existing guardrail): must stay green untouched — the whole integration is one manifest entry, one store-data entry, and files under `src/lib/apps/microtracker/`. Any temptation to branch OS code on `microtracker` is a design error.
- **`pattern.test.ts`** (new, pure):
  - set/get/clear cell; out-of-range row/channel rejected.
  - serialize → deserialize round-trip equality for an empty pattern, the demo song, and a pattern with all effect types.
  - validation: wrong `fmt`, wrong channel count, out-of-range note/vol/fx values → typed error, no throw.
  - note↔frequency and note↔display-name mapping (A-4 = 57 = 440 Hz; noise pitch-class → KCK/SNR/HAT buckets).
- **`engine.test.ts`** (new, no real audio — inject a fake clock/context or test the pure parts):
  - `rowDuration(bpm)` math, including mid-play BPM change producing the new duration on the next accumulation.
  - scheduler emits rows monotonically, wraps 63 → 0, and schedules everything inside the lookahead window exactly once (drive with a mocked `currentTime`).
  - arpeggio emits three retunes at t, t+d/3, t+2d/3; slide emits one ramp to the correct target frequency.
  - `stop()` and `dispose()` clear the interval and cancel envelopes (spy on the fake nodes).
- **Component test** (if the repo has precedent for window component tests; otherwise cover via acceptance checklist): destroy → `engine.dispose()` called.
- Manual pass of the acceptance checklist in `pnpm dev`, including one screen recording of demo mode to validate the viral hook actually looks right.

## 10. Risks & open questions

- **Menu → window command routing.** `menus(os)` gets no window handle. The PRD assumes a small command-bus module mirroring however TextEdit wires its Save item; the builder must check that precedent first and copy it rather than inventing a parallel mechanism.
- **AudioContext-per-window.** Several open modules = several contexts. Browsers allow dozens; fine at this scale. If the OS later grows a shared audio service, the engine's construction is the only seam that changes.
- **Background-tab throttling.** `setInterval` in a background tab can be clamped to 1 s, starving a 120 ms lookahead. Acceptable for v1 (the tab is the whole OS; music with the tab hidden is a non-goal). If it matters later: bump lookahead when `document.hidden`, or move the scheduler to a Worker.
- **No undo in v1.** A tracker without undo will annoy power users; scoped out consciously. The pattern model should keep mutations funneled through a few methods so v2 undo is a command log, not a rewrite.
- **Keyboard collisions with OS shortcuts.** Space, ⌘N, ⌘S, ⌘W inside a focused tracker window must not fight the OS menu accelerators; verify the window-focus key handling precedent (how TextEdit swallows typing) and follow it.
- **`fileType: 'data'` coarseness.** The closed `FileType` union has no music/module member. v1 rides on `contentType` routing, which works; if module files should ever get their own Finder icon or type-level behavior, that union grows in an OS-level change (out of scope here — note it, don't do it).
- **Open question — where do modules live?** `/Documents` is assumed. If Terminal HD ever grows a `/Music` well-known folder, first-save default should move there; one constant.
- **Open question — demo song licensing of vibe.** The bundled tune must be an original composition (the one in `demo.html` is), not a cover, so it is safe to ship and screen-record.
