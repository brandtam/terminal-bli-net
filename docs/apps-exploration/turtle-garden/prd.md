# Turtle Garden — PRD

LOGO turtle graphics rebuilt as a toy for TerminalOS. You type a command, a pixel turtle walks and draws chunky phosphor lines on a dark canvas — every line you run joins an editable program pane beside the canvas. Three typed lines bloom into a spirograph.

Status: exploration. Interactive demo at `docs/apps-exploration/turtle-garden/demo.html`.

---

## 1. Overview & audience

The target user is a kid raised on touchscreens who has never typed a command at a computer. Turtle Garden's job is to teach the oldest trick in computing — *you type, the machine obeys* — with an instant, gorgeous payoff.

That audience assumption drives every design decision:

- **The keyboard IS the discovery.** No prior knowledge is assumed. The app never punishes a wrong guess; every failure is a nudge toward a working command.
- **Forgiving parser.** Case-insensitive. Extra whitespace ignored. Short aliases (`FD`, `RT`) accepted everywhere. Commands chain on one line so copy-typing a whole spell works.
- **Friendly errors.** Every error message contains a runnable fix, e.g. `FORWARD needs a number. TRY: FORWARD 50`. Unknown words get a nearest-match suggestion: `I don't know "FROWARD". Did you mean FORWARD?`. Errors never use words like "syntax", "invalid", "parse", or "token".
- **Autocomplete hint bar.** A one-line bar under the input. While the input is empty it rotates gentle prompts (`TRY: FORWARD 50`, `TRY: REPEAT 8 [ FORWARD 60 RIGHT 45 ]`). While typing, it shows commands whose names start with the current word, with their argument shape (`FORWARD n · move ahead`). Purely informational in v1 — no tab-completion.
- **The program is visible and editable.** A program pane sits beside the canvas. Every line you run at the prompt appends to it; spells load their full source into it; you can edit any line and RUN redraws from the top. The pane *is* the artifact — what you see is what saves, and reading a program you can change is how the pedagogy actually lands.
- **Examples before docs.** Four spell buttons produce spectacular output and *show their full source typing into the program pane*, so the path from "press button" to "I changed the 5 to a 7 and pressed RUN" is one step.

The pedagogy target: within 10 seconds of launch a user has made the turtle move; within 2 minutes they have run a spell, changed a number in it, and seen the drawing change.

## 2. Viral hook

Three typed lines bloom into a hypnotic spirograph:

```
RAINBOW
REPEAT 300 [ FORWARD 230 RIGHT 151 ]
```

The turtle visibly walks every segment while the hue cycles — the drawing *grows* on screen over ~20 seconds at default speed. That growth is the screen-recordable moment. Design requirements that protect it:

- Drawing is animated by default, never instant (instant is an opt-in speed setting).
- Chunky-pixel phosphor lines on a near-black canvas — the period look — with an opt-in NEON glow mode for people who want the modern recording aesthetic.
- The GALAXY spell button reproduces the hook in one tap and leaves its full source sitting in the program pane, inviting mutation.
- Finished drawings save to Terminal HD, so the artifact persists inside the OS world.

## 3. UX walkthrough

1. **Launch.** User double-clicks Turtle.app (installed from the Computer Store). One window opens: dark canvas on the left, the **program pane** on the right (header: PROGRAM · STOP · RUN ▶), a command line beneath the canvas with a blinking `?` prompt (the classic LOGO prompt), the hint bar under that, and a spell/controls strip. The turtle sits at canvas center pointing up, and blinks every few seconds — a small idle animation that says "I'm alive, talk to me."
2. **First command.** Hint bar shows `TRY: FORWARD 50`. User types it (any casing), presses Enter. The turtle audibly plinks and visibly walks 50 pixels up, leaving a chunky phosphor line — and the line of code appears in the program pane. The prompt *writes the program*; a short scrollback log above the input echoes commands and errors.
3. **First spell.** User taps STAR. The spell's full source types itself into the program pane (fast — visible but not tedious), then runs. A yellow five-pointed star draws itself, and the source sits in the pane: visible, editable, theirs now.
4. **Mutation.** User clicks into the program pane, changes `144` to `100`, presses RUN (or ⌘-Enter). The canvas clears, the turtle homes, and the edited program redraws from the top. This loop (read → tweak → RUN) is the core play pattern; ArrowUp history at the prompt covers quick single-line pokes.
5. **Going big.** GALAXY runs a 300-iteration rainbow rosette. User discovers the SPEED control to slow it down for recording or crank it to instant for iteration, and the PIXELS control to go chunkier or finer.
6. **Saving.** File → Save Drawing (⌘S) prompts for a name and writes the *program pane's text* to Terminal HD (see §8). The file appears in Documents; double-clicking it later reopens Turtle Garden with the program in the pane and replays the drawing.
7. **Starting over.** The CLEAR button wipes the canvas, homes the turtle, and empties the program pane — a save always reproduces exactly what is on the canvas. (Typed `CLEAR` is just a command: it wipes and homes mid-program and stays in the listing, so RUN still reproduces the canvas.)

## 4. Language spec v1

### Command set

| Command | Alias | Argument | Effect |
|---|---|---|---|
| `FORWARD n` | `FD` | number | Walk n pixels ahead, drawing if pen is down |
| `BACK n` | `BK` | number | Walk n pixels backward |
| `RIGHT n` | `RT` | number | Turn clockwise n degrees |
| `LEFT n` | `LT` | number | Turn counterclockwise n degrees |
| `PENUP` | `PU` | — | Stop drawing while moving |
| `PENDOWN` | `PD` | — | Resume drawing |
| `COLOR x` | — | name or 0–360 | Set pen color; turns rainbow mode off |
| `RAINBOW` | — | — | Rainbow pen: hue advances a few degrees per segment |
| `REPEAT n [ … ]` | — | count + block | Run the bracketed commands n times; nests arbitrarily |
| `CLEAR` | `CS` | — | Wipe canvas, home the turtle (stays in the program listing) |
| `HOME` | — | — | Jump to center, heading up, **without** drawing |

Color names: `RED ORANGE YELLOW GREEN CYAN BLUE PURPLE PINK WHITE`. A number is treated as an HSL hue (0–360, clamped).

Semantics decisions (differ from classic LOGO where kid-friendliness wins):

- `HOME` never draws. Classic LOGO draws a line home when the pen is down; that surprises beginners and ruins drawings. Documented in Help.
- `CLEAR` also homes (classic `CLEARSCREEN` behavior). As a command it stays in the program listing so RUN reproduces the canvas; only the CLEAR *button* empties the program pane.
- Heading 0 = up (classic LOGO), `RIGHT` is clockwise.
- Numbers may be negative or fractional (`FORWARD -20`, `RIGHT 172.5`). No expressions, no variables in v1.
- The turtle may walk off-canvas; lines are simply clipped. No wrapping in v1.

### Parser behavior

- **Tokenize** on whitespace; `[` and `]` are always their own tokens even without surrounding spaces (`REPEAT 4[FD 50 RT 90]` works).
- **Recursive descent** over the token stream producing an AST: a program is a list of `{cmd, arg}` nodes and `{repeat, count, body}` nodes; `body` is itself a program, giving nesting for free. REPEAT nesting depth is unlimited in grammar; execution caps total emitted segments (see below).
- Case-insensitive throughout. Multiple commands per line; newlines are whitespace, so a `REPEAT` body may span lines in the program pane.
- On any error, **nothing executes** — a prompt line or a RUN is all-or-nothing, so a half-run never corrupts the canvas relative to the program pane.
- **Runaway guard:** a single line may expand to at most 100,000 primitive steps (multiplied REPEAT counts). Beyond that: `That's too many steps for one spell! Try a smaller REPEAT.` REPEAT count must be a whole number ≥ 1.

### Error messages

All errors follow the shape *what happened → what to try*, in the app's plain voice:

| Situation | Message |
|---|---|
| Unknown word | `I don't know "FROWARD". Did you mean FORWARD?` (nearest command by edit distance ≤ 2, else `TRY: FORWARD 50`) |
| Missing number | `FORWARD needs a number. TRY: FORWARD 50` |
| Bad color | `I don't know the color "BLURPLE". TRY: COLOR PINK — or a number 0–360.` |
| REPEAT missing `[` | `REPEAT needs [ brackets ] around the commands to repeat. TRY: REPEAT 4 [ FORWARD 50 RIGHT 90 ]` |
| Unclosed `[` | `A [ is missing its ]. Add ] at the end.` |
| Stray `]` | `There's a ] with no [ before it.` |

## 5. Scope cuts (explicit non-goals for v1)

Deferred to v2, deliberately:

- **Procedures** (`TO SQUARE … END`) — the natural next step, but it doubles parser and UX surface.
- **Variables and expressions** (`:SIZE`, `FORWARD :SIZE * 2`) — required for true spirals; v1 fakes spirals with nested REPEAT.
- **Multiple turtles.**
- **PNG export** — v1 saves replayable command files only (§8); "Export Picture…" is v2.
- **SETXY / arc commands / fill / pen width.**
- Tab-completion in the hint bar (v1 hints are display-only).

## 6. Drawing spec

- **Animated walking.** FORWARD/BACK execute as a walk: the turtle advances along the segment over multiple frames, the line extending behind it. Turns are instantaneous (animating rotation adds nothing).
- **Execution model.** The AST executes through a generator/iterator yielding primitive ops (`move`, `turn`, `pen`, `color`, …) so a `REPEAT 300` never materializes as recursion during animation and can be paused between any two ops.
- **Never lock the UI.** All drawing happens inside `requestAnimationFrame` with a per-frame time budget (~12 ms). Each frame advances the current segment by `speed` pixels and pulls further ops until the budget is spent. Even "instant" speed is budget-chunked — a pathological spell degrades to fast animation, never a frozen window.
- **Speed control.** Three settings: `1×` (10 px/frame ≈ 600 px/s, the default — a short FORWARD visibly walks, and GALAXY stays hypnotic for minutes), `4×` (40 px/frame — completes GALAXY in ~30 s, the recording speed), and `MAX` (as fast as the frame budget allows). A new command while a drawing is animating queues behind it.
- **Pixel-grid rendering, period by default.** Two stacked canvases: a persistent **trail canvas** (segments are drawn once and accumulate — no per-frame full redraw) and a transparent **overlay canvas** redrawn each frame with just the turtle sprite. The trail canvas *is* the pixel grid: its backing store is the canvas area divided by the **pixel size** (adjustable 1–4, **default 3** — chunky, the period-correct look), upscaled with `image-rendering: pixelated`. Default line style is a flat 1-grid-pixel phosphor stroke, no glow — what turtle graphics actually looked like. Default pen color is white (Apple II LOGO convention).
- **NEON mode (opt-in).** A toggle switches the segment renderer to the modern look: a wide low-alpha `shadowBlur` pass in the pen color plus a thin bright core. Off by default; it exists for people recording clips, not as the identity of the app.
- **Pixel size / NEON changes re-render** by re-running the program pane instantly and silently (no animation, no plinks). Same mechanism handles window resize — no bitmap preservation needed; the program is the source of truth.
- **Rainbow mode** advances the hue ~7° per segment (per FORWARD command, not per pixel), so a 36-segment star sweeps most of the wheel.
- **Overlay canvas resolution** matches the window's device-pixel ratio so the turtle sprite stays crisp on retina displays. Logical drawing space is the window's canvas area; origin (HOME) at its center.
- **Turtle sprite:** authored pixel art (~15×15 logical px grid drawn programmatically, scaled ×2), a small green turtle with shell, head, and feet, drawn onto the overlay rotated to the current heading. Idle blink: eyes toggle briefly every ~4 s while no program is running.

## 7. Sound spec

- **One sound: the plink.** A short WebAudio note at the start of each drawn segment. Oscillator: `triangle`; gain envelope: attack 5 ms to ~0.12, exponential decay to silence over ~180 ms; a single shared `GainNode` master at 0.5 into `destination`. No samples, no external assets.
- **Pitch follows heading.** Map the turtle's heading (0–360°, normalized) onto a two-octave **major pentatonic scale** rooted at 220 Hz: `index = round(heading / 360 * 10)`, frequencies `220 · 2^(steps[index]/12)` with pentatonic steps `[0,2,4,7,9,12,14,16,19,21,24]`. Turning shapes therefore play arpeggios; a REPEAT spell becomes a melodic loop. Pentatonic guarantees nothing sounds sour.
- **Rate limit:** at most one plink per 30 ms (MAX speed would otherwise buzz). Skipped plinks are dropped, not queued.
- **Autoplay policy:** the `AudioContext` is created/resumed on the first user gesture (first Enter or button press). No sound before that; no error either.
- **Mute toggle** in the controls strip (🔊/🔇), persisted in the app's preferences. Default: sound on.

## 8. Visual spec

- **Palette.** Canvas `#0a0a12` (near-black, faint blue). Pen defaults to white (period); named colors render flat at `hsl(h 100% 60%)`. UI chrome follows the TerminalOS window style; inside the content area, a chunky inset bezel around the canvas, monospace type everywhere (the OS mono stack), dim green-on-dark for the log and program pane, amber for the hint bar, red-pink for errors (still friendly in tone).
- **Layout** (single window, default 860×560, min 620×420):
  - Left column: canvas (fills available space), scrollback log (~3 lines of echoed commands/errors), command line (`?` prompt + text input), hint bar.
  - Right column: **program pane** — header row (`PROGRAM · STOP · RUN ▶`), multi-line editable text area, footer hint (`EDIT FREELY · RUN REDRAWS FROM THE TOP`). ~300px wide; stacks below the canvas at narrow window sizes.
  - Controls strip (full width, bottom): spell buttons `STAR SPIRAL FLOWER GALAXY`, `SPEED 1×/4×/MAX`, `PIXELS 1/2/3/4` (default 3), `NEON` toggle (default off), `CLEAR`, mute.
- **Spells** (exact v1 sources; SPIRAL and FLOWER deliberately demonstrate *nested* REPEAT, formatted multi-line so the pane teaches indentation by example):
  - STAR — `COLOR YELLOW` / `REPEAT 5 [ FORWARD 150 RIGHT 144 ]`
  - SPIRAL — `RAINBOW` / `REPEAT 60 [` / `  REPEAT 4 [ FORWARD 100 RIGHT 90 ]` / `  RIGHT 6` / `]`
  - FLOWER — `RAINBOW` / `REPEAT 12 [` / `  REPEAT 6 [ FORWARD 60 RIGHT 60 ]` / `  RIGHT 30` / `]`
  - GALAXY — `RAINBOW` / `REPEAT 300 [ FORWARD 230 RIGHT 151 ]`
- **Input affordances:** ArrowUp/ArrowDown command history at the prompt (session-scoped); Enter runs a line and appends it to the program pane; ⌘-Enter in the pane = RUN; input keeps focus after running; clicking empty window space refocuses the input (never steals focus from the pane).

## 9. TerminalOS integration spec

### Manifest (`src/lib/terminalos/apps/manifests.ts`)

Store app; follows the Player pattern (exact launch window + prefix document window):

```ts
defineApp({
	id: 'turtle-garden',
	name: 'Turtle Garden',
	fileName: 'Turtle.app',
	category: 'entertainment',
	description: 'Type commands, grow neon art',
	icon: '🐢',
	removable: true,
	desktopAliasByDefault: false,
	isSystem: false,
	status: 'released',
	iconKind: 'doc', // pick/verify against available PixelIcon glyphs; conformance test enforces
	windows: [
		{
			// Launch window: blank garden. No `opens` here (launch windows must not claim types).
			match: { kind: 'exact', id: 'turtle-garden' },
			role: 'app',
			title: () => 'Turtle Garden',
			size: () => ({ w: 860, h: 560, minW: 620, minH: 420 }),
			component: () => import('$lib/apps/turtle-garden/TurtleGardenWindow.svelte')
		},
		{
			// Document window: opens a saved drawing and replays it.
			match: { kind: 'prefix', prefix: 'turtle-garden:', arg: 'fileId' },
			role: 'app',
			title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'Turtle Garden',
			size: () => ({ w: 860, h: 560, minW: 620, minH: 420 }),
			component: () => import('$lib/apps/turtle-garden/TurtleGardenWindow.svelte'),
			opens: { contentTypes: ['text/x-turtle-garden'] }
		}
	],
	aboutSpec: {
		title: 'Turtle Garden',
		version: 'v0.1',
		tagline: 'you type, the turtle draws',
		glyph: '🐢',
		glyphBg: 'var(--paper-soft)',
		glyphFg: 'var(--ink)',
		sections: [
			{
				h: 'WHAT IT IS',
				body: 'A turtle that obeys typed commands and draws. FORWARD 50 to start. REPEAT to go wild. Your program builds itself beside the canvas — edit it and RUN.'
			}
		]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [
				{ type: 'action', label: 'Save Drawing…', shortcut: '⌘S', action: () => {/* emit save event to focused window */} },
				{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
			]
		},
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About Turtle Garden', action: () => os.openAbout('turtle-garden') }]
		}
	],
	statusExtra: () => null
});
```

One component serves both windows: it reads `window.args.fileId` from `getAppContext()`; if present, it loads the file body and replays it at 4× on open, otherwise it starts blank.

### Store entry (`src/lib/apps/computer-store/store-data.ts`)

Add to `APPS` (matching the existing tone — dry, a little deadpan):

```ts
{
	id: 'turtle-garden',
	cat: 'ENT',
	title: 'TURTLE GARDEN',
	pub: 'PAPERT & SONS',
	tagline: 'The turtle obeys.',
	icon: 'turtle', // add/verify a store icon glyph
	sticker: 'NEW',
	back: 'A turtle sits on a black screen and does exactly what you type. FORWARD 50. RIGHT 144. REPEAT 300 and suddenly it\'s art. The 1980s taught a generation to program this way. Your move.',
	inside: ['One obedient turtle', 'REPEAT (it nests)', 'Rainbow pen', 'Plink sounds'],
	reqs: 'Terminal OS 1.0 · A keyboard'
}
```

Verify the `ENT` category entry in `CATEGORIES` covers it (it exists already).

### Persistence

**Recommendation: save drawings as replayable program files, not picture blobs.**

- Format: the program pane's text, verbatim, UTF-8. First line `; TURTLE GARDEN v1` as a comment/format marker (`;` lines are skipped on replay). Because the pane is the artifact, save/load is literally a text round-trip — reopening puts the program back in the pane and replays it.
- Storage: `fs.createBlobFile(DOCUMENTS_ID, name, encodedBytes, { appId: 'turtle-garden', opensWith: 'turtle-garden', fileType: 'data', contentType: 'text/x-turtle-garden' })`. The blob path is required because inline-text bodies carry no `contentType`, and `contentType` is what the prefix window's `opens` claim routes on; `opensWith` makes routing explicit regardless.
- Why command-list over picture blob:
  1. It replays — reopening a drawing re-animates it, which *is* the product experience, and it invites further mutation (the pane is pre-loaded for editing).
  2. It's tiny (bytes vs. hundreds of KB of PNG in IndexedDB) — kind to the Terminal HD quota story.
  3. It's future-proof: v2 PNG export can always be derived from the commands; the reverse is impossible.
  4. Pedagogically right: a saved file a kid can open in TextEdit (v2: register the type) and read is a program they wrote.
- PNG export ("Export Picture…") is v2, via `canvas.toBlob` → `createBlobFile` with `contentType: 'image/png'`.
- Do **not** claim `fileTypes: ['text']` in `opens` — that collides with TextEdit's claim and the manifest loader throws on duplicate claims.
- Mute preference and last speed setting persist via the app-preferences mechanism (localStorage side), not as FS files.

### File layout

```
src/lib/apps/turtle-garden/
	TurtleGardenWindow.svelte   // window shell: canvases, input, controls
	interpreter.ts              // tokenizer + recursive-descent parser + op generator (pure, no DOM)
	interpreter.test.ts
	sound.ts                    // plink synth (lazy AudioContext)
	spells.ts                   // the four spell strings
```

Parser and executor live in a pure TS module with no Svelte/DOM imports so unit tests run in plain vitest.

## 10. Acceptance criteria

1. Fresh install from Computer Store → launch → typing `forward 50` (lowercase) draws a visible chunky phosphor line with a plink, and the line appears in the program pane.
2. All commands and aliases in §4 work; unknown/malformed input never executes anything, never touches the program pane, and always produces a §4-style hint.
3. `REPEAT 3 [ REPEAT 4 [ FD 30 RT 90 ] RT 120 ]` draws three rotated squares — nesting is correct, including when the REPEAT body spans multiple lines in the pane.
4. GALAXY spell animates without any frame taking >50 ms (no UI lockup); input and pane stay responsive during drawing.
5. Tapping a spell loads its full source into the program pane and runs it; editing a number in the pane and pressing RUN (or ⌘-Enter) clears, homes, and redraws the edited program from the top.
6. ArrowUp at the prompt recalls the last typed line verbatim; STOP halts drawing without touching the pane.
7. Speed control changes animation rate; MAX completes GALAXY in under ~2 s. Pixel size defaults to 3 (chunky); switching to 1/2/4 re-renders the same program instantly and silently, as does toggling NEON (default off) and resizing the window.
8. Mute toggle silences plinks immediately and persists across relaunch.
9. ⌘S saves the pane's text to Documents; the file double-clicks open into a Turtle Garden window with the program in the pane and the drawing replayed.
10. CLEAR button wipes canvas, homes turtle, and empties the pane; typed `CLEAR` wipes/homes but stays in the listing, and RUN after it reproduces the canvas exactly.
11. No sound plays and no console error appears before the first user gesture.
12. `pnpm check` and `pnpm test:unit` pass; no OS-code edits outside the two registration files (`manifests.ts`, `store-data.ts`).

## 11. Test plan

- **`app-conformance.test.ts`** (existing, automatic): both windows route to the app, components load, icon kind valid, window ids unique. Verifies the manifest is well-formed.
- **`zero-os-edit.test.ts`** (existing, automatic): must stay green — proves no OS branches were added for turtle-garden.
- **`interpreter.test.ts`** (new unit tests, pure module):
  - Tokenizer: bracket splitting without spaces, case folding, decimals, negatives.
  - Every command + alias parses to the expected AST node.
  - Nested REPEAT: 2- and 3-deep nesting expands to the correct op sequence and count; `REPEAT 0`/fractional/negative counts rejected.
  - Errors: each §4 error case yields the exact expected message; erroring lines emit zero ops.
  - Runaway guard trips at the step cap.
  - Geometry: after `REPEAT 4 [ FD 100 RT 90 ]` the turtle is back at origin heading 0 (within float epsilon).
  - Replay round-trip: serializing a session and re-parsing yields an identical op stream.
- **Manual QA script:** acceptance criteria 1–11 walked on desktop Chrome/Safari/Firefox; retina + non-retina; window resize and pixel-size change mid-drawing (both re-render the program instantly — the in-flight animation is abandoned, which is documented behavior).

## 12. Risks & open questions

- **Resize/re-render abandons animation.** Because resize and pixel-size changes re-run the program instantly, a resize mid-GALAXY skips to the finished drawing. Acceptable (the program pane makes re-running free), but verify it doesn't feel like a bug; a "resume animating from where you were" refinement is possible if it does.
- **iconKind / store icon.** The manifest `iconKind` must match an existing PixelIcon glyph and the store card needs an icon; if no turtle-ish glyph exists, either reuse `doc` or add a sprite (adding one touches shared UI — check conformance constraints first).
- **Save-menu wiring.** Menus are built at the manifest level; Save needs to reach the focused window's component (event/callback pattern — check how other apps with File menus do it before inventing one).
- **Audio on iPad/touch devices.** The audience skews touch; the plink gesture-unlock must count taps on spell buttons as gestures (it does, but verify on iOS Safari).
- **Step cap value.** 100k steps is a guess; GALAXY is 300. Validate the cap against MAX-speed frame budget on a low-end Chromebook.
- **Replay of files edited by hand** (v2 TextEdit interop): garbage lines in a saved file should degrade to per-line friendly errors on replay, not abort the whole file. V1 files are app-written only, so this is deferred but the replay loop should already be per-line tolerant.
- **Color vocabulary.** Nine names may be too few; kids will type `BLACK` (invisible on the canvas) and `BROWN`. Decide: alias BLACK→dim gray with a wink message, or error.
