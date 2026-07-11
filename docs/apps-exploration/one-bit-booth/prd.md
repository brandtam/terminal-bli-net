# 1-Bit Booth — PRD

App exploration for TerminalOS. A photo booth that renders your webcam the way a 1987 computer would have: 1-bit ordered dither, Game Boy green, or amber phosphor. Stills only — the OS already has Camera (Recorder) for video clips; this app never touches MediaRecorder.

Status: exploration. Companion interactive demo: [`demo.html`](demo.html).

## Overview & audience

1-Bit Booth is a creative toy, not a utility. You point it at your face and it shows you, live, at 160×120 and two (or four) colors. A big shutter button captures the frame to a photo strip; strip photos save to Terminal HD or download as PNG.

Target audience: people raised on touchscreen selfie cameras. The selfie is their most rehearsed gesture; the app hijacks it and returns the most alien possible output. Nothing to learn — the entire UI is a viewfinder, three mode buttons, some stamps, and a shutter.

Distinct from Camera/Recorder: Recorder captures video/webm clips played by Player. 1-Bit Booth captures image/png stills it can view itself. No shared code, no shared file types, no `recorder` window ids.

## Viral hook

The clip is the reaction. The live preview updates in real time, so the moment someone leans into frame and sees themselves in 1-bit — "this is what cameras used to see??" — is inherently screen-recordable. Dithered selfies are also natively shareable: small, weird, instantly recognizable as a style, and watermark-free. The demo file is the pitch: record the preview, post it, done.

Design consequences:

- Live preview must be smooth (≥15 fps target, ~30 typical). A janky preview kills the reaction.
- The dither must be correct. Bad dithering reads as "broken filter"; correct Bayer reads as "old computer." This is the whole app.
- Capture output should look good pasted anywhere: fixed 640×480 PNG, chunky 4× pixels, no chrome baked in (stamps yes, UI no).

## Privacy stance

Plainly: all processing happens locally in the browser tab. Frames go from the camera to a canvas and nowhere else. Nothing is uploaded, no analytics on image content, no network requests in the capture path. Saved photos live in the user's own Terminal HD (localStorage manifest + IndexedDB blob bytes) or download straight to their machine.

- Camera permission prompt copy (shown in-app before calling `getUserMedia`):
  > 1-Bit Booth needs your camera to show the live preview. Video never leaves this computer — every frame is processed right here in your browser and thrown away unless you press the shutter.
- The browser's own permission prompt follows; we never call `getUserMedia` before the user clicks "Start Camera".
- Graceful no-camera fallback: if permission is denied, no device exists, or the context is insecure, the viewfinder runs a built-in animated test pattern (gradient calibration bars + bouncing pixel smiley) through the same dither pipeline. Every feature except "it's your face" still works — modes, stamps, shutter, strip, save. The status line reads `TEST PATTERN` instead of `LIVE`.
- Stopping: closing the app window stops all tracks (`track.stop()` in component teardown). No background capture, ever.

## UX walkthrough

1. **Launch.** Buy in Computer Store → install → double-click `1-Bit Booth.app`. One fixed window opens (~420×560). Viewfinder shows the test pattern immediately with a "START CAMERA" button and the privacy copy overlaid.
2. **Permission.** User clicks Start Camera → we call `getUserMedia` → browser prompt. Grant: preview crossfades from test pattern to live dithered feed, status LED reads `LIVE`. Deny/fail: short alert ("No camera — running the test pattern instead"), test pattern keeps going.
3. **Live dither.** Feed is mirrored (selfie convention), downscaled to 160×120, ordered-dithered, upscaled 4× with nearest-neighbor into a CRT-styled viewport. Brightness/contrast sliders below the viewfinder feed the luminance stage.
4. **Mode switching.** Three chunky radio buttons: `1-BIT`, `GAME BOY`, `AMBER`. Instant switch, applies to preview and future captures. UI blip on press.
5. **Stamps.** Toggle buttons: deal-with-it sunglasses, pixel crown, "RAD!" speech bubble. Drawn over the dithered frame in palette colors at fixed positions; toggling is instant; active stamps bake into captures.
6. **Shutter.** One oversized round button. Press → WebAudio camera-clunk + 120 ms white flash → still is captured with Floyd–Steinberg ("fine" dither, see below) at 640×480 and slides into the photo strip.
7. **Strip.** Horizontal row of recent shots below the shutter (newest first, capped at 12 in-session). Click a shot → small action row: **Save to Disk** (Terminal HD), **Download PNG**, **Trash**.
8. **Save.** Save to Disk writes a blob-body file to the Photos folder (see persistence). A saved badge appears on the strip thumbnail. Double-clicking the saved file in Finder later reopens it in a 1-Bit Booth viewer window.

## Dithering spec

Two dither paths: **ordered (Bayer 4×4)** for the live preview — cheap, stable frame-to-frame, era-correct — and **Floyd–Steinberg error diffusion** for captured stills ("fine" mode) — better detail, too shimmery/expensive per-frame for live use.

### Buffer geometry

- Work buffer: **160×120** offscreen canvas. All sampling, dithering, and stamp drawing happens here.
- Source draw: `drawImage(video, …)` with cover-crop math (scale = `max(160/vw, 120/vh)`, centered) and a horizontal mirror (`translate(W,0); scale(-1,1)`). The GPU does the downscale; per-pixel work is only ever 19,200 pixels.
- Display: the 160×120 canvas is shown at 4× via CSS (`image-rendering: pixelated`), i.e. a 640×480 viewport of chunky pixels. Never dither at display resolution.
- Frame loop: `requestAnimationFrame`; each frame = one `drawImage` + one `getImageData` + one pass + one `putImageData`. This holds 30+ fps on anything made this decade; 15 fps is the floor on low-end hardware.

### Luminance

Rec. 601 luma per pixel: `L = 0.299·R + 0.587·G + 0.114·B` (0–255). Then brightness/contrast: `L' = clamp((L − 128) · contrast + 128 + brightness, 0, 255)` with contrast ∈ [0.5, 2.0] default 1.0, brightness ∈ [−100, +100] default 0.

### Ordered dither (live)

Bayer 4×4 matrix, standard index order:

```
 0  8  2 10
12  4 14  6
 3 11  1  9
15  7 13  5
```

Per pixel at (x, y), palette of N levels (N = 2 or 4):

```
t    = (BAYER[(y & 3) * 4 + (x & 3)] + 0.5) / 16      // threshold in (0,1)
v    = L' / 255 * (N − 1)
base = floor(v)
idx  = base + ((v − base) > t ? 1 : 0)                 // clamp to N − 1
out  = palette[idx]
```

Verified properties (unit-test these exact assertions on the extracted kernel):

- L' = 0 → all pixels level 0; L' = 255 → all pixels level N−1 (solid endpoints).
- N = 2, L' = 128 → exactly 8 of 16 pixels white per Bayer tile (50% ± ε); L' = 64 → 25%; L' = 191 → 75%.
- Tile-average density is monotonically non-decreasing in L' for N = 2 and N = 4.
- N = 4 ramp 0→255 emits all four indices.
- The matrix is a permutation of 0–15.

### Floyd–Steinberg (captured stills, "fine" mode)

On shutter press only, re-dither the *pre-dither* luminance buffer (keep the last raw 160×120 luma frame around) with standard FS serpentine-free left-to-right diffusion:

```
err distributed:  x+1: 7/16   x−1,y+1: 3/16   x,y+1: 5/16   x+1,y+1: 1/16
quantize: nearest of the N palette levels (levels at k·255/(N−1))
```

Then stamps are drawn on top, then the 160×120 result is upscaled 4× nearest-neighbor to the 640×480 capture canvas → PNG. A prefs toggle "Fine capture dither" (default on) falls back to baking the ordered-dither preview verbatim when off — some users will want the capture to match exactly what they saw.

### Stamps

Author each stamp as a tiny grid of `#` (dark = palette[0]), `o` (light = palette[N−1]), `.` (transparent) in source; draw with per-pixel `fillRect` on the work buffer *after* dithering so edges stay crisp. Fixed anchor positions (sunglasses center-third, crown top-center, bubble top-right). Stamps use only palette endpoint colors so they read in every mode.

## Modes

| Mode | Levels | Palette (dark → light) | Homage |
| --- | --- | --- | --- |
| `1-BIT` | 2 | `#0a0a0a`, `#e8e8e0` | Classic Mac 1-bit (slightly warm white, not pure `#fff`) |
| `GAME BOY` | 4 | `#0f380f`, `#306230`, `#8bac0f`, `#9bbc0f` | Game Boy Camera / DMG LCD |
| `AMBER` | 4 | `#140a00`, `#663c00`, `#c27800`, `#ffb000` | Amber phosphor terminal |

Mode is app-level state; switching costs nothing (same kernel, different palette array). Default on first launch: `1-BIT`.

## Feature list v1 + scope cuts

**v1:**

- Live Bayer-dithered preview, three modes, ≥15 fps.
- Brightness/contrast sliders.
- Three stamps (sunglasses, crown, RAD! bubble), toggleable, baked into captures.
- Shutter with sound + flash; FS fine-dither capture at 640×480 PNG.
- In-session strip (cap 12) with Save to Disk / Download PNG / Trash per shot.
- Test-pattern fallback; full feature set works without a camera.
- Saved photos are blob files openable from Finder in a Booth viewer window.
- Prefs dialog: fine-capture toggle, default mode, sound on/off.

**v2 (explicitly cut from v1):**

- Animated GIF strip (4 shots → looping GIF; needs a GIF encoder, real work).
- Self-timer (3-2-1 beeps).
- Extra filters (invert, threshold-only "no dither", Bayer 8×8).
- Camera picker for multi-camera machines.
- Custom stamp editor.

## Sound spec

All WebAudio, synthesized, no audio assets. One shared `AudioContext` created lazily on first user gesture (autoplay policy). Global sound toggle in prefs.

- **Shutter clunk** (~140 ms, two layers):
  1. Thump: square oscillator, 180 Hz → exponential ramp to 50 Hz over 90 ms; gain 0.5 → exp ramp to 0.001 over 120 ms.
  2. Mechanical click: 50 ms white-noise buffer through a bandpass (~2.2 kHz, Q ≈ 1), gain 0.35 → exp decay over 50 ms.
- **UI blip** (mode/stamp buttons): square oscillator 880 Hz, 35 ms, gain 0.12 with fast exp decay.
- **Error buzz** (storage full, camera denied): square 110 Hz, 180 ms, gain 0.15.

## Visual spec

The app chrome is era-correct and chunky — the window itself should photograph well in a screen recording.

- Platinum/beige panel (`#d6d3c7`-family) with 1-px black outlines and hard white/dark bevels; no border-radius over 2 px, no gradients except the CRT vignette.
- Viewfinder: near-black inset well around the canvas, CSS scanline overlay (`repeating-linear-gradient`, 2-px period, ~8% black) + faint radial vignette. Canvas gets `image-rendering: pixelated`.
- Status line under the viewfinder: LED dot + `STANDBY` / `LIVE` / `TEST PATTERN` in monospace caps.
- Shutter: oversized round button (~64 px), red-ringed, with a pressed state that visually travels 2 px.
- All labels monospace, uppercase, letter-spaced. Uses the OS design tokens (`--paper`, `--ink`, `--accent`) where they exist; no external fonts.
- Photo strip: white-bordered "prints" with 1-px shadow, slight alternating rotation (±1°) for the booth-strip feel.

## TerminalOS integration spec

### Manifest sketch (`src/lib/terminalos/apps/manifests.ts`)

```ts
defineApp({
	id: 'onebit-booth',
	name: '1-Bit Booth',
	fileName: '1-Bit Booth.app',
	category: 'entertainment',
	description: 'Photo booth that sees like 1987',
	icon: '▚',
	removable: true,
	desktopAliasByDefault: true,
	isSystem: false,
	status: 'released',
	iconKind: 'camera', // new PixelIcon glyph — see note below
	windows: [
		{
			// The booth itself: one fixed window, NOT a document handler.
			match: { kind: 'exact', id: 'onebit-booth' },
			role: 'app',
			title: () => '1-Bit Booth.app',
			size: () => ({ w: 420, h: 560 }),
			component: () => import('$lib/apps/onebit-booth/BoothWindow.svelte')
		},
		{
			// Viewer: one window per saved photo, LaunchServices-routed.
			match: { kind: 'prefix', prefix: 'onebit:', arg: 'fileId' },
			role: 'app',
			title: (c) => c.fs.getFile(c.args.fileId)?.name ?? 'Photo',
			size: () => ({ w: 480, h: 420 }),
			component: () => import('$lib/apps/onebit-booth/PhotoViewerWindow.svelte'),
			opens: { contentTypes: ['image/png'], fileTypes: ['photo'] }
		},
		{
			match: { kind: 'exact', id: 'onebit-booth-prefs' },
			role: 'prefs',
			title: () => 'Booth Preferences',
			size: () => ({ w: 320, h: 260 }),
			component: () => import('$lib/apps/onebit-booth/BoothPrefsWindow.svelte')
		}
	],
	aboutSpec: {
		title: '1-Bit Booth',
		version: 'v1.0',
		tagline: 'see yourself the way 1987 did',
		glyph: '▚',
		glyphBg: 'var(--ink)',
		glyphFg: 'var(--paper)',
		sections: [
			{
				h: 'WHAT IT IS',
				body: 'A photo booth. Your camera, live, in 1-bit dither, Game Boy green, or amber phosphor. Press the big button.'
			},
			{
				h: 'PRIVACY',
				body: 'Every frame is processed on this computer and never uploaded. Photos save to your Terminal HD or download as PNG.'
			}
		]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [
				{ type: 'action', label: 'Take Photo', shortcut: '⌘T', action: () => boothState.requestShutter() },
				{ type: 'separator' },
				{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
			]
		},
		{
			label: 'Mode',
			items: [
				{ type: 'action', label: '1-Bit', action: () => boothState.setMode('onebit') },
				{ type: 'action', label: 'Game Boy', action: () => boothState.setMode('gameboy') },
				{ type: 'action', label: 'Amber', action: () => boothState.setMode('amber') }
			]
		},
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About 1-Bit Booth', action: () => os.openAbout('onebit-booth') }]
		}
	],
	statusExtra: () => (boothState.live ? { label: 'CAM', kind: 'rec' } : null)
});
```

Notes:

- `boothState` is a small module-level `$state` store (`booth-state.svelte.ts`), same pattern as `recorderState` — it lets menus and `statusExtra` reach the running window without props.
- The booth window declares **no** `opens`; only the viewer prefix window does. A launch window with `opens` silently steals routing (writing-an-app.md, window-spec section).
- The `CAM` status badge shows only while the camera is actually live — an honest tally light.
- `iconKind: 'camera'` requires adding one glyph branch to `src/lib/components/PixelIcon.svelte`. That's a shared-component addition, not an OS-routing edit; the conformance test validates the kind exists. If we want zero shared-file edits, fall back to `iconKind: 'tv'`.

### Store entry (`src/lib/apps/computer-store/store-data.ts`)

```ts
{
	id: 'onebit-booth',
	cat: 'ENT',
	title: '1-BIT BOOTH',
	pub: 'DITHER LABS',
	tagline: 'Say cheese in two colors.',
	icon: 'camera',
	sticker: 'NEW',
	back: 'A photo booth from a timeline where cameras never got better. Your face, live, at 160×120 in exactly two colors — or four, if you spring for Game Boy green. Big red button. Real clunk. Photo strip included.',
	inside: ['3 film stocks: 1-bit, Game Boy, amber', 'Deal-with-it sunglasses, crown, RAD! bubble', 'Photo strip · saves to Terminal HD'],
	reqs: 'Terminal OS 1.0 · A face · A camera (optional)'
}
```

Plus append `'onebit-booth'` to the `ENT` category's `appIds`.

### Persistence

Follows the Recorder pattern exactly (ADR 0002 blob-body lifecycle): manifest metadata in localStorage via the FS manifest store, PNG bytes in IndexedDB via `IndexedDBBodyStore`.

```ts
const bytes = await captureBlob.arrayBuffer(); // PNG from canvas.toBlob('image/png')
const result = await fs.createBlobFile(PHOTOS_FOLDER_ID, name, bytes, {
	appId: 'onebit-booth',
	opensWith: 'onebit-booth', // explicit routing beats contentType lookup
	fileType: 'photo',
	contentType: 'image/png'
});
```

- **Folder:** first choice is a well-known `Photos` folder alongside `Recordings` (needs a small `terminal-fs.ts` seed addition — flag in review). Fallback with zero FS edits: `DOCUMENTS_ID`.
- **Naming:** `Booth 001.png`, counter-bumped past `fs.exists` collisions (same loop Recorder uses).
- **Routing:** `opensWith: 'onebit-booth'` routes double-click explicitly (rule 1); the viewer's `opens: { contentTypes: ['image/png'] }` additionally makes Booth the system PNG handler (rule 2) so foreign PNGs open too.
- **Storage-quota courtesy:** a 640×480 dithered PNG is nearly ideal for DEFLATE — expect **5–35 KB** per photo (1-bit smallest; a measured 4-level Game Boy capture from the demo is ~31 KB). In-session strip capped at 12; saved photos soft-capped at **48 on disk** (~1.7 MB worst case). At the cap, Save to Disk shows the error buzz + an `os.alert` telling the user to trash old photos. Handle `createBlobFile` failure (`storage full`) with the same alert path Recorder uses.

## getUserMedia constraints + caveats

```ts
navigator.mediaDevices.getUserMedia({
	video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
	audio: false
});
```

- Request small — we only sample down to 160×120; asking for 1080p wastes decode work and battery.
- `audio: false` always. The permission prompt should say camera, not camera+mic; anything else undermines the privacy stance.
- **Secure context required:** `getUserMedia` exists only on `https:` and `localhost`. On `http:` (or when `navigator.mediaDevices` is undefined) skip straight to the test pattern with an explanatory status line.
- **iOS Safari:** the hidden `<video>` needs `playsInline` (and `muted`) or iOS fullscreens it; call `video.play()` from the same user gesture as the Start Camera click; the video element must be in the DOM (can be visually hidden, not `display:none` on older Safari). `videoWidth/Height` are 0 until `loadedmetadata` — gate the first `drawImage` on it.
- **Desktop:** device may be busy (another app), yielding `NotReadableError` — treat like denial, message "camera is in use elsewhere," fall back to test pattern.
- **Teardown:** on window close and on component `onDestroy`, `stream.getTracks().forEach(t => t.stop())` and cancel the rAF loop. Also stop the loop (keep the last frame) when the OS marks the window minimized, if that signal exists — battery courtesy.
- Mirroring: preview and captures are both mirrored (selfie convention; matches what phone front cameras save).

## Acceptance criteria

1. Fresh disk: app appears in Computer Store (ENT), buys, installs, launches from `/Applications` and the desktop alias.
2. Launch with no camera interaction shows the animated test pattern dithered in the current mode; every control works against it.
3. Start Camera on a machine with a webcam: live mirrored preview within 2 s of grant, sustained ≥15 fps at 160×120 (measure with a frame counter in dev).
4. Deny the permission: alert appears once, test pattern continues, no console errors, Start Camera can be retried.
5. Mode buttons switch preview palette instantly; endpoint colors match the table in Modes exactly.
6. Dither correctness: 50% gray input in 1-BIT mode produces a checkerboard-density field (8/16 white per Bayer tile) — verified by the kernel unit tests and eyeball-verified via the test pattern's gradient bar.
7. Shutter produces clunk + flash + a strip entry; captured PNG is 640×480, nearest-neighbor chunky, includes active stamps, uses FS dithering when the fine toggle is on.
8. Save to Disk creates a blob file with `contentType: 'image/png'`, `fileType: 'photo'`, `opensWith: 'onebit-booth'`; double-clicking it in Finder opens the Booth viewer window showing the photo.
9. Download PNG works with no network (file downloads from a data/object URL).
10. Disk cap: 49th save is refused with the alert; nothing corrupts.
11. Closing the window stops the camera (OS/browser tally light goes off) and the rAF loop.
12. `pnpm check`, `pnpm test:unit` (including app-conformance, zero-os-edit, and the new dither tests) pass.

## Test plan

- **`app-conformance.test.ts`** — passes automatically once the manifest entry is valid: unique window ids, real lazy components, valid `iconKind` (add the `camera` glyph first or use `tv`).
- **`zero-os-edit.test.ts`** — must stay green untouched; the app adds no OS branches. The only shared-file edits are the manifest array, store-data, PixelIcon glyph, and (optionally) the Photos folder seed — all extension points.
- **`dither.test.ts`** (new, `src/lib/apps/onebit-booth/`) — pure-function tests on the extracted kernels, no canvas needed:
  - Bayer matrix is a permutation of 0–15.
  - Ordered kernel: solid endpoints; 128 → 50%, 64 → 25%, 191 → 75% density at N = 2; monotonic tile density for N ∈ {2, 4}; all four levels emitted across a ramp at N = 4.
  - Luma: `luma(255,255,255) === 255`, `luma(0,0,0) === 0`, green outweighs red outweighs blue.
  - Brightness/contrast clamp to [0, 255].
  - Floyd–Steinberg on a fixture 8×8 50%-gray tile at N = 2: output mean within 1/64 of input mean (error conservation), and total error rows sum ≈ 0.
- **`booth-save.test.ts`** — `createBlobFile` metadata shape, name-collision bumping, cap-at-48 refusal (mirror `body-gc.test.ts` patterns).
- **Manual matrix** — Chrome/Firefox/Safari desktop + iOS Safari: grant, deny, no-device, device-busy, backgrounded tab, quota-full.

## Risks & open questions

- **PNG handler scope.** Claiming `contentTypes: ['image/png']` makes Booth the OS-wide PNG opener. Fine today (nothing else claims it); revisit if a real image viewer ships — routing throws on duplicate claims, so this is a forced decision then, not silent breakage.
- **Photos folder.** New well-known folder vs. dumping into Documents. A seed addition to `terminal-fs.ts` touches FS code — check `docs/adr/` (ADR 0001/0002 territory) before doing it; Documents is the no-touch fallback.
- **Performance floor.** 160×120 ordered dither is cheap, but `getImageData` every frame on a software-rendered canvas could hurt on very low-end machines. Mitigation if needed: `willReadFrequently: true` on the 2D context (do this from the start), and drop to 15 fps via frame-skipping rather than shrinking the buffer.
- **iOS capture size.** `canvas.toBlob` PNG on iOS is fine at 640×480; no known issue, but verify memory behavior with the strip at cap.
- **Fine-dither surprise.** FS capture won't pixel-match the ordered preview. The prefs toggle covers it, but the default (fine on) is a taste call — flip if playtesters find it confusing.
- **Stamp positions vs. faces.** Fixed anchors won't line up with every face. v1 accepts this (it's a toy; misaligned sunglasses are funny). Face tracking is out of scope permanently.
- **Menu shortcut collisions.** `⌘T` for Take Photo — confirm the OS menu system doesn't already reserve it.
