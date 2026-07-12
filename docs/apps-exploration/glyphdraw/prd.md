# GlyphDraw — PRD

An ANSI/ASCII art studio for TerminalOS in the spirit of TheDraw (1986). Character-cell canvas, 16-color ANSI foreground/background, block and box-drawing character sets, keyboard-first workflow with mouse painting. Art saves as documents on Terminal HD and exports to PNG. The signature feature is **transmission playback**: replaying a finished piece character-by-character as if it were arriving over a 2400-baud modem.

This document is written so an agent can build the app in this repo without follow-up questions. Repo entry points: `docs/writing-an-app.md`, `docs/terminalos-architecture.md`, `src/lib/terminalos/apps/manifests.ts`, `src/lib/apps/textedit/` (the document-handler pattern GlyphDraw copies).

A self-contained interactive teaser lives next to this file at `demo.html`. It demonstrates the canvas model, palette, charsets, and transmission playback with synthesized modem audio. Use it as the visual/behavioral reference; the numbers in this PRD win where they differ.

---

## 1. Overview & audience

**What it is.** A window with an 80×25 character grid. Every cell holds one character, one of 16 foreground colors, one of 16 background colors. You paint cells with a brush (a character + color pair) using the mouse, or move a block cursor with the keyboard and stamp/type characters. Charset banks map to F1–F10 like TheDraw. Documents live on Terminal HD as `.gly` files and reopen by double-click in Finder.

**Audience.** Retro computing enthusiasts — people who remember (or wish they remembered) TheDraw, ACiD/iCE ANSI packs, and BBS login screens. Secondary: anyone on social media who enjoys watching art appear one character at a time.

**Why it fits TerminalOS.** The OS already sells the fiction of a late-80s machine. An ANSI editor is period-native software, it exercises the document-routing path (a third real document type after text and recordings), and playback mode produces the most screen-recordable output any current app has.

**Not goals.** GlyphDraw is not a pixel paint program (the store already lists `paint`), not a terminal emulator, and not an `.ANS` interchange tool in v1 (import/export of real ANSI escape files is v2).

## 2. Viral hook

**Transmission playback.** One menu item / toolbar button. The canvas blanks, a half-second carrier handshake plays, then the artwork re-arrives cell by cell in scan order at a selectable baud rate (300 / 1200 / 2400 / 9600 → chars/sec = baud ÷ 10), with a bright reveal cursor and synthesized modem warble. At 2400 baud a typical 80×25 piece takes 5–8 seconds — exactly the length of a social clip. The user screen-records it (or the OS Recorder captures it) and posts it.

Why it works: the payoff is watching a finished piece assemble itself, so every shared clip is simultaneously a demo of the viewer's art *and* an ad for the app. Zero extra authoring effort — every saved document is already a playback.

## 3. UX walkthrough

**First launch.** User buys GlyphDraw in the Computer Store (BUSINESS shelf), installs from My Shelf, double-clicks `GlyphDraw.app`. The launch handler creates `Untitled.gly` in `/Documents` (uniquified: `Untitled 2.gly`, …) pre-filled with a small welcome artwork (the GlyphDraw logo in a double-line box plus a one-line hint: `F1–F10 CHARS · TAB SETS · ESC MENU`), and opens it. The user sees a working canvas within one interaction, mirroring TextEdit's launch behavior.

**Creating.** Left tool rail: brush preview, four charset banks (blocks, single-line box, double-line box, misc), 16-swatch FG row, 16-swatch BG row. The user clicks a swatch and a character, then click-drags on the canvas; drags are interpolated so fast strokes leave no gaps. Right-drag erases (space on default bg). Alt-click eyedrops a cell into the brush. Keyboard path: arrows move the blinking block cursor, Space stamps the brush, any printable key sets the brush character; toggling TEXT mode (Insert or the mode button) makes printable keys write directly into the grid and advance the cursor, Backspace steps back and erases — typing a caption feels like a text editor. Undo is ⌘Z, 50 levels, snapshot-per-stroke.

**Saving.** ⌘S. Dirty state shows as `•` before the window title's file name. Save encodes the document and replaces the file's blob body. Save As… prompts for a name via `os.alert` with a text field if available, else appends a numbered copy (see Open questions §10). Files are visible in Finder under `/Documents` and reopen into a `glyphdraw:<fileId>` window on double-click.

**Playback.** View ▸ Transmit ▶ (or the toolbar button). Canvas blanks, handshake tones play (the menu click is the user gesture that unlocks WebAudio), cells re-arrive at the selected baud with warble + hiss, ending with a soft "connect" double-beep and the full artwork. Esc or clicking Abort restores the canvas instantly. Painting is disabled while transmitting. A baud selector sits next to the button.

**Export.** File ▸ Export PNG…. Renders the grid to an offscreen canvas at 2× cell resolution (no grid lines, no cursor, no scanlines) and triggers a browser download `<name>.png`. Nothing is written to Terminal HD (see §7.5).

## 4. Feature list

### v1

- Fixed 80×25 canvas; cell = character + fg(0–15) + bg(0–15).
- Mouse painting with drag interpolation; right-drag erase; Alt-click eyedropper.
- Keyboard: arrow cursor, Space stamp, any-printable-sets-brush, `[`/`]` cycle FG, `{`/`}` cycle BG, Tab cycles charset bank, F1–F10 pick character from the active bank, TEXT entry mode, ⌘Z undo (50 levels), Delete/Backspace erase.
- Four charset banks of exactly 10 characters each (F1–F10 mapping):
  - BLOCKS `█ ▓ ▒ ░ ▀ ▄ ▌ ▐ ■ ·`
  - SINGLE `─ │ ┌ ┐ └ ┘ ├ ┤ ┼ ┴`
  - DOUBLE `═ ║ ╔ ╗ ╚ ╝ ╠ ╣ ╬ ╦`
  - MISC `○ ● ♥ ♦ ♣ ♠ ☺ ★ ↑ ~`
- 16-color VGA palette for FG and BG (all 16 legal as bg; we are not bound by real CGA's 8-bg limit).
- New / Open / Save / dirty tracking; documents on Terminal HD; Finder double-click reopens.
- Transmission playback with 300/1200/2400/9600 baud, synthesized modem audio, abort.
- PNG export via browser download.
- Sound on/off preference (persisted, see §7.4).

### v2+ (explicit cuts)

- `.ANS`/`.ASC` import/export with SAUCE records; CP437 mapping table.
- Resizable canvas (up to 132×50) and canvas-size chooser on New.
- Block selection: cut/copy/paste/move/flip regions.
- Half-block "hi-res" mode (paint 80×50 pseudo-pixels with `▀▄█`).
- Stamp/sprite library and custom user banks.
- Animation frames / multi-page documents.
- Save PNG to Terminal HD (blocked on an image viewer app existing; today an `image/png` blob would route to the raw-id dead-window fallback).
- Shareable playback deep link; BBS app integration (post art to a board).
- Custom palettes (ICE colors, C64, gameboy).

## 5. Visual spec

Era target: DOS TUI, TheDraw/QEdit chrome. The app window uses standard TerminalOS chrome; everything inside the content area goes full DOS.

**Palette (VGA/CGA 16, use these exact hexes):**

| # | name | hex | # | name | hex |
|---|------|-----|---|------|-----|
| 0 | black | `#000000` | 8 | dark gray | `#555555` |
| 1 | blue | `#0000AA` | 9 | bright blue | `#5555FF` |
| 2 | green | `#00AA00` | 10 | bright green | `#55FF55` |
| 3 | cyan | `#00AAAA` | 11 | bright cyan | `#55FFFF` |
| 4 | red | `#AA0000` | 12 | bright red | `#FF5555` |
| 5 | magenta | `#AA00AA` | 13 | bright magenta | `#FF55FF` |
| 6 | brown | `#AA5500` | 14 | yellow | `#FFFF55` |
| 7 | light gray | `#AAAAAA` | 15 | white | `#FFFFFF` |

**Layout.** Left tool rail ~180px (brush preview, charset banks, FG/BG swatch rows, mode indicator); main canvas area on pure `#000000`; a one-line cyan status bar (`#00AAAA` bg, black text — the TheDraw/Norton convention) pinned to the window bottom showing cursor position, brush char, FG/BG, mode, and key hints. Toolbar row above the canvas: Transmit ▶, baud select, Clear, Export PNG, sound toggle, grid toggle.

**Canvas rendering.** One `<canvas>` 2D context, logical cell 8×16 (device-pixel-ratio scaled), `image-rendering: pixelated` on the element. Font: `ui-monospace, Menlo, Consolas, "DejaVu Sans Mono", monospace` — no webfonts. To guarantee gapless art regardless of platform font metrics, draw these glyphs procedurally as rects/dither instead of `fillText`: `█ ▀ ▄ ▌ ▐ ■` (rects) and `░ ▒ ▓` (2×2 Bayer dither at 25/50/75% with 2px dots). Everything else via centered `fillText`. Blinking block cursor (~400ms), inverse-style white outline. Optional subtle scanline overlay (CSS `repeating-linear-gradient`, ~15% black every 3px), off by default, toggle in prefs.

**Typography elsewhere.** Same monospace stack; all-caps labels; accent colors from the palette only (cyan for chrome accents, yellow for highlights, DOS blue `#0000AA` for headers).

## 6. Sound spec

All audio synthesized with WebAudio at runtime. No audio assets, no fetches. One lazily created `AudioContext`, constructed/resumed only inside a user-gesture handler (the Transmit click). Master `GainNode` at 0.12; sound-off preference sets it to 0. Nothing plays outside playback (keystroke click sounds are a v2 pref, default off).

**Transmission audio graph:**

- **Hiss** — 1s white-noise `AudioBuffer`, looped, → bandpass (1700 Hz, Q 0.7) → gain 0.18 → master. Runs for the whole transmission.
- **Handshake** — square oscillator at 2100 Hz (answer tone) for ~250 ms, gain ramp 0 → 0.09 over 20 ms; data reveal starts 600 ms after Transmit.
- **Data warble** — the same oscillator hops between the Bell 212A frequencies `1070 / 1270 / 2025 / 2225 Hz` every ~45 ms (interval timer, `setValueAtTime`), through a 2600 Hz lowpass, gain jittered 0.05–0.10 per hop.
- **Completion** — warble/hiss ramp to 0 over ~50 ms, then two short square beeps (1046 Hz then 1568 Hz, 70–120 ms, exponential decay) as a "CONNECT" flourish. Abort skips the beeps.

All nodes are stopped and dereferenced when playback ends; the `AudioContext` itself is kept for reuse.

## 7. TerminalOS integration spec

### 7.1 Manifest (`src/lib/terminalos/apps/manifests.ts`)

Store app, document handler, prefix window, custom launch — the TextEdit pattern. New files: `src/lib/apps/glyphdraw/GlyphDrawWindow.svelte`, `src/lib/apps/glyphdraw/glyphdraw-launch.ts`, `src/lib/apps/glyphdraw/glyphdraw-doc.ts` (pure document model), `src/lib/apps/glyphdraw/glyphdraw-audio.ts`, `src/lib/apps/glyphdraw/glyphdraw-prefs.svelte.ts`.

```ts
import { launchGlyphDraw } from '$lib/apps/glyphdraw/glyphdraw-launch';

export const GLYPHDRAW_MIME = 'application/x-glyphdraw+json'; // exported from glyphdraw-doc.ts

defineApp({
	id: 'glyphdraw',
	name: 'GlyphDraw',
	fileName: 'GlyphDraw.app',
	category: 'productivity',
	description: 'ANSI/ASCII art studio',
	icon: '▓',
	removable: true,
	desktopAliasByDefault: false,
	isSystem: false,
	status: 'released',
	iconKind: 'doc', // must be an existing PixelIcon glyph; see Open questions for a bespoke sprite
	windows: [
		{
			// One window per document, TextEdit-style. No exact launch window;
			// launch always resolves to a document via the custom handler.
			match: { kind: 'prefix', prefix: 'glyphdraw:', arg: 'fileId' },
			role: 'app',
			title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'Untitled.gly',
			size: () => ({ w: 780, h: 580 }),
			component: () => import('$lib/apps/glyphdraw/GlyphDrawWindow.svelte'),
			opens: { contentTypes: ['application/x-glyphdraw+json'] }
		}
	],
	launch: { kind: 'custom', handler: launchGlyphDraw },
	aboutSpec: {
		title: 'GlyphDraw',
		version: 'v1.0',
		tagline: 'paint with the alphabet',
		glyph: '▓',
		glyphBg: '#000000',
		glyphFg: '#55FFFF',
		sections: [
			{
				h: 'WHAT IT IS',
				body: 'A character-cell art studio. 80 columns, 25 rows, 16 colors, and every glyph the machine can print. Draw it, save it, then transmit it at 2400 baud.'
			},
			{
				h: 'CREDITS',
				body: 'TheDraw (1986), the ANSI scene, and everyone who ever waited for a login screen to finish arriving.'
			}
		]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [
				{ type: 'action', label: 'New', shortcut: '⌘N', action: () => os.launchApp('glyphdraw', { action: 'new' }) },
				{ type: 'action', label: 'Open…', shortcut: '⌘O', action: () => os.launchApp('glyphdraw', { action: 'open' }) },
				{ type: 'separator' },
				{ type: 'action', label: 'Save', shortcut: '⌘S' },          // handled in-window via menu-action bridge; see Open questions
				{ type: 'action', label: 'Export PNG…' },
				{ type: 'separator' },
				{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
			]
		},
		{
			label: 'Edit',
			items: [
				{ type: 'action', label: 'Undo', shortcut: '⌘Z' },
				{ type: 'separator' },
				{ type: 'action', label: 'Clear Canvas' }
			]
		},
		{
			label: 'View',
			items: [
				{ type: 'action', label: 'Transmit ▶' },
				{ type: 'action', label: 'Scanlines' },
				{ type: 'action', label: 'Grid' }
			]
		},
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About GlyphDraw', action: () => os.openAbout('glyphdraw') }]
		}
	],
	statusExtra: () => null
});
```

Follow the exact `menus` item shapes used by existing apps; if the repo has no window-scoped menu-action bridge, wire Save/Export/Transmit as in-window toolbar buttons and leave the menu items `disabled: true` like TextEdit's Edit menu does (see §10).

### 7.2 Launch handler (`glyphdraw-launch.ts`)

Clone `src/lib/apps/textedit/textedit-launch.ts` semantics:

- `payload.action === 'new'` → uniquified `Untitled.gly` in `DOCUMENTS_ID`, body = encoded blank doc (or welcome doc on very first launch — detect via a prefs flag), then `ctx.os.openDocument(file)`.
- `payload.action === 'open'` → `os.alert` listing `/Documents` files where `opensWith === 'glyphdraw'` or `bodyRef.contentType === GLYPHDRAW_MIME`.
- bare launch (double-click app icon) → same as `'new'`.

File creation call:

```ts
const bytes = encodeDoc(blankDoc(80, 25)); // Uint8Array of JSON
await ctx.fs.createBlobFile(DOCUMENTS_ID, name, bytes.buffer, {
	appId: 'glyphdraw',
	opensWith: 'glyphdraw',
	fileType: 'data',
	contentType: GLYPHDRAW_MIME
});
```

### 7.3 Document model & persistence (`glyphdraw-doc.ts`)

**Format** (JSON, versioned):

```jsonc
{
	"format": "glyphdraw",
	"version": 1,
	"cols": 80,
	"rows": 25,
	"chars": ["<80-char string per row>", "..."],   // 25 strings
	"colors": ["<160 hex chars per row>", "..."]    // fg nibble + bg nibble per cell
}
```

Pure functions, no Svelte, fully unit-testable: `blankDoc(cols, rows)`, `encodeDoc(doc): Uint8Array`, `decodeDoc(buf): Result<Doc, DecodeError>` (rejects wrong `format`, `version > 1`, row/length mismatches, non-hex color data), `setCell`, `getCell`, `playbackSequence(doc)` → ordered `{ index, ch, fg, bg }[]` skipping blank cells (`ch === ' ' && bg === 0`).

**Decision: blob body (IndexedDB), not inline text.** The repo splits storage: the filesystem manifest (including every inline-text body) persists via `LocalStorageManifestStore`; blob bodies persist via `IndexedDBBodyStore` (`docs/terminalos-architecture.md`, ADR 0002). An 80×25 document is ~6 KB of JSON and users will accumulate many; inline bodies would ride inside the localStorage manifest, which is rewritten on every fs mutation and shares the ~5 MB origin quota with preferences and window layout. Twenty artworks inline ≈ 120 KB of manifest bloat re-serialized on every file operation OS-wide; as blobs it's zero. Blob bodies also carry a `contentType`, which is what lets `opens: { contentTypes: [...] }` claim routing without widening the closed `FileType` union in `src/lib/terminalos/filesystem/types.ts` (`'text' | 'sticky' | 'recording' | 'app' | 'data' | 'unknown'`) — no OS edit, `zero-os-edit` stays honest. Cost: reads are async (`fs.readBody(bodyRef.bodyId)` on window mount, show a brief `LOADING…` state) and bodies are excluded from the manifest's synchronous view — both acceptable. Redundant belt-and-suspenders: also set `opensWith: 'glyphdraw'`, which wins at routing step 1 even if `contentType` were lost.

**Save path.** `fs.replaceBlobFileBody(fileId, encodeDoc(doc).buffer, { contentType: GLYPHDRAW_MIME })` — writes the new immutable body first, GCs the old one after commit (already implemented in `terminal-fs.ts`). Window keeps `fileId` from `window.args`; never builds raw window ids.

**Load path.** On mount: `fs.peekNode(args.fileId)` → `bodyRef.kind === 'indexeddb-blob'` → `fs.readBody(bodyId)` → `decodeDoc`. Decode failure shows an in-window error panel ("This file isn't a GlyphDraw document") — never a crash.

### 7.4 Preferences

Small module store `glyphdraw-prefs.svelte.ts` (pattern: `src/lib/apps/vcr/vcr-prefs.svelte`): `{ soundOn: boolean, scanlines: boolean, grid: boolean, baud: 300|1200|2400|9600, welcomed: boolean }`, persisted the same way existing app prefs persist (they ride in browser preferences and are included in OS backups).

### 7.5 Playback & export mechanics

**Playback** runs entirely inside the document window (no extra window spec). `playbackSequence(doc)` gives the reveal order; a `requestAnimationFrame` loop reveals `floor(elapsed_since_handshake × baud/10)` cells cumulatively, drawing only newly revealed cells plus a reveal cursor, so cost per frame is O(new cells). Painting, undo, and save are disabled while transmitting; Esc aborts and does a full re-render. Audio per §6.

**Export** renders every cell to an offscreen canvas at 16×32 px/cell (1280×800 for 80×25) with the same procedural-glyph renderer, `canvas.toBlob('image/png')` → object URL → anchor `download="<basename>.png"` → revoke. Pure browser download; no Terminal HD write in v1 (no installed app opens `image/png`, and unknown documents currently fall to the dead raw-id window — see architecture Follow-Ups).

### 7.6 Store entry (`src/lib/apps/computer-store/store-data.ts`)

Append to `APPS`:

```ts
{
	id: 'glyphdraw',
	cat: 'PROD',
	title: 'GLYPHDRAW',
	pub: 'CHARACTER WORKS',
	tagline: 'Paint with the alphabet.',
	icon: 'glyphdraw', // follow the existing store box-art icon convention (tetra/card/bomb…); add art or reuse the closest existing key
	sticker: 'NEW',
	back: 'Eighty columns. Twenty-five rows. Sixteen colors. Every character the machine can print, and a few it probably should not. Draw your masterpiece, then transmit it at 2400 baud and watch it arrive like it is 1988 and the phone line is holding its breath.',
	inside: ['4 charset banks on F1–F10', 'Transmission playback', 'PNG export', 'Undo (50 deep)'],
	reqs: 'Terminal OS 1.0 · CGA or better · No phone line required'
}
```

And add `'glyphdraw'` to `CATEGORIES.business.appIds`.

## 8. Acceptance criteria

All must pass on a fresh profile (cleared localStorage + IndexedDB):

1. GlyphDraw appears in the Computer Store under BUSINESS; buy → My Shelf → Install creates `/Applications/GlyphDraw.app`.
2. Launching before install is blocked by the OS install gate (no bypass path).
3. Double-clicking `GlyphDraw.app` creates and opens `Untitled.gly` in `/Documents`; repeat launches uniquify (`Untitled 2.gly`).
4. First-ever document contains the welcome artwork; subsequent New documents are blank.
5. Click-drag paints the brush; a fast diagonal drag leaves a gapless line; right-drag erases; Alt-click sets brush char+fg+bg from the cell.
6. F1–F10 select from the active bank, Tab cycles banks, `[`/`]`/`{`/`}` cycle colors, any printable key sets the brush char, and every one of these states is visible in the status bar.
7. TEXT mode: printable keys write into the grid and advance the cursor; Backspace erases backward; Esc leaves TEXT mode.
8. ⌘Z undoes at least 50 consecutive strokes.
9. ⌘S clears the dirty marker; file `updatedAt` changes; body is `indexeddb-blob` with `contentType: application/x-glyphdraw+json`; reload the browser tab and the document reopens with identical cells.
10. Double-clicking a `.gly` file in Finder opens it in GlyphDraw (routing via `opensWith` and via `contentType` both verified — clear `opensWith` in a test to prove the contentType path).
11. Transmit blanks the canvas, plays handshake + warble (only after the click; no autoplay warnings in console), reveals cells at baud/10 chars/sec ±10%, ends with the complete artwork and connect beeps; Esc aborts and restores instantly; sound-off pref silences everything.
12. Export PNG downloads a 1280×800 PNG whose pixels match the canvas (spot-check block glyphs solid, dither at 25/50/75%).
13. An empty document transmits nothing and shows a status hint instead.
14. Opening a corrupted `.gly` (truncated JSON) shows the error panel; the window stays usable via File ▸ New.
15. No OS-layer file is modified except the required manifest entry and store-data entry; `pnpm check`, `pnpm test:unit` pass.

## 9. Test plan

- **`app-conformance.test.ts`** (existing, must pass untouched): the `glyphdraw:` prefix window routes back to `glyphdraw`, component loader resolves a real Svelte component, window id unique, `iconKind` is a valid `PixelIcon` glyph.
- **`zero-os-edit.test.ts`** (existing, must pass untouched): proves no OS branch was added for GlyphDraw.
- **Document model unit tests** (`glyphdraw-doc.test.ts`, new):
  - `blankDoc` dimensions and defaults (space, fg 7, bg 0).
  - encode → decode round-trip is cell-exact, including all 16×16 color pairs and every bank character.
  - `decodeDoc` rejects: wrong `format`, `version: 2`, wrong row count, row string length mismatch, odd-length/non-hex color rows, non-JSON bytes — each returns a typed error, never throws.
  - `setCell` bounds-checks; out-of-range is a no-op or typed error (pick one, test it).
  - `playbackSequence`: scan order, skips `' '`+bg 0, includes `' '` on colored bg, length matches non-blank count.
- **Routing tests** (extend the existing `resolveOpenTarget` suite): a file with `contentType: application/x-glyphdraw+json` and no `opensWith` resolves to the `glyphdraw:` window; `opensWith: 'glyphdraw'` resolves regardless of contentType.
- **Launch handler tests** (`glyphdraw-launch.test.ts`, new, against a fresh `TerminalFS`): `'new'` creates a uniquified blob file with the right MIME and opens it; `'open'` lists only GlyphDraw files.
- **Component logic**: keep the window component thin; brush/cursor/undo reducers live in a plain module (`glyphdraw-editor.ts`) with unit tests (stroke interpolation hits every cell on a (0,0)→(79,24) drag; undo depth capped at 50).
- **Manual/Playwright (if the repo adds browser coverage)**: acceptance items 1–3, 9–11.

## 10. Risks & open questions

- **Menu → window action bridge.** Stats/TextEdit menus only call global `os` methods; Save/Undo/Transmit need to reach the focused window's component. Check how any existing app bridges this (e.g., an os event, a module store the window subscribes to, or `os.launchApp(id, payload)` re-entry). If no pattern exists, v1 ships those as in-window toolbar buttons and menu items stay `disabled: true` (TextEdit precedent). Do not invent an OS mechanism for this app.
- **Save As / rename UX.** If `os.alert` supports no text input, v1 relies on Finder rename (files are ordinary fs nodes). Confirm and document in-app ("rename in Finder").
- **`fileType: 'data'` icon.** `.gly` files will show the generic data icon in Finder. Acceptable for v1; a bespoke PixelIcon glyph (and `iconKind`) for both the app and its documents is a fast follow — adding a glyph to the shared sprite set is an additive change, not an OS branch.
- **Store box-art icon key.** `store-data.ts` `icon` values (`tetra`, `card`, `bomb`…) map to store-side artwork; confirm the mapping mechanism and add a `glyphdraw` key the same way, or reuse the closest existing art until one is drawn.
- **F-key capture.** Browsers own some function keys (F11 fullscreen, F12 devtools); F1 may open help on some platforms even with `preventDefault`. Mitigation: `preventDefault` on F1–F10 only, never F11/F12; every F-key action also has a click path (the bank buttons), so nothing is keyboard-only.
- **Font metrics variance.** `fillText` glyph coverage differs across platform monospace fonts; box-drawing lines may show hairline gaps on some systems. Blocks/shades are procedural (immune); if box-drawing gaps look bad in review, extend procedural drawing to the line sets (26 glyphs, straightforward rect math).
- **Autoplay policy.** `AudioContext` must be created/resumed inside the Transmit click handler. Playback triggered any other way (e.g., a future auto-demo mode) must run silent.
- **Quota.** Blob bodies land in IndexedDB alongside recordings; a 6 KB art file is noise, but the export path never writes to Terminal HD, so GlyphDraw can't meaningfully pressure the disk. No action needed beyond the existing disk-usage accounting.
- **Scope honesty.** The viral loop depends on screen recording outside the app. In-OS Recorder capture of a GlyphDraw window is plausible but is Recorder's concern, not GlyphDraw's; do not couple them in v1.
