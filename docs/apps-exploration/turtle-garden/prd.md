# Turtle Garden — PRD

LOGO turtle graphics rebuilt as a generative-art toy for TerminalOS. You type a command, a pixel turtle walks and draws glowing neon lines on a dark canvas. Three typed lines bloom into a spirograph.

Status: exploration. Interactive demo at `docs/apps-exploration/turtle-garden/demo.html`.

---

## 1. Overview & audience

The target user is a kid raised on touchscreens who has never typed a command at a computer. Turtle Garden's job is to teach the oldest trick in computing — *you type, the machine obeys* — with an instant, gorgeous payoff.

That audience assumption drives every design decision:

- **The keyboard IS the discovery.** No prior knowledge is assumed. The app never punishes a wrong guess; every failure is a nudge toward a working command.
- **Forgiving parser.** Case-insensitive. Extra whitespace ignored. Short aliases (`FD`, `RT`) accepted everywhere. Commands chain on one line so copy-typing a whole spell works.
- **Friendly errors.** Every error message contains a runnable fix, e.g. `FORWARD needs a number. TRY: FORWARD 50`. Unknown words get a nearest-match suggestion: `I don't know "FROWARD". Did you mean FORWARD?`. Errors never use words like "syntax", "invalid", "parse", or "token".
- **Autocomplete hint bar.** A one-line bar under the input. While the input is empty it rotates gentle prompts (`TRY: FORWARD 50`, `TRY: REPEAT 8 [ FORWARD 60 RIGHT 45 ]`). While typing, it shows commands whose names start with the current word, with their argument shape (`FORWARD n · move ahead`). Purely informational in v1 — no tab-completion.
- **Examples before docs.** Four spell buttons produce spectacular output and *show their code being typed into the input*, so the path from "press button" to "I typed that myself and changed the 5 to a 7" is one step.

The pedagogy target: within 10 seconds of launch a user has made the turtle move; within 2 minutes they have run a spell, changed a number in it, and seen the drawing change.

## 2. Viral hook

Three typed lines bloom into a hypnotic spirograph:

```
RAINBOW
REPEAT 300 [ FORWARD 230 RIGHT 151 ]
```

The turtle visibly walks every segment while the hue cycles — the drawing *grows* on screen over ~20 seconds at default speed. That growth is the screen-recordable moment. Design requirements that protect it:

- Drawing is animated by default, never instant (instant is an opt-in speed setting).
- Neon glow trails on a near-black canvas so phone screen recordings look good.
- The GALAXY spell button reproduces the hook in one tap and leaves its code sitting in the input, inviting mutation.
- Finished drawings save to Terminal HD, so the artifact persists inside the OS world.

## 3. UX walkthrough

1. **Launch.** User double-clicks Turtle.app (installed from the Computer Store). One window opens: dark canvas filling most of the window, a command line beneath it with a blinking `?` prompt (the classic LOGO prompt), the hint bar under that, and a spell/controls strip. The turtle sits at canvas center pointing up, and blinks every few seconds — a small idle animation that says "I'm alive, talk to me."
2. **First command.** Hint bar shows `TRY: FORWARD 50`. User types it (any casing), presses Enter. The turtle audibly plinks and visibly walks 50 pixels up, leaving a glowing line. The command echoes into a short scrollback log above the input.
3. **First spell.** User taps STAR. The spell's command text types itself into the input character by character (fast, ~15 ms/char — visible but not tedious), then submits. A yellow five-pointed star draws itself. The code remains the last log entry.
4. **Mutation.** User presses ArrowUp — the spell text returns to the input. They change `144` to `100`, press Enter, and get a different shape. This loop (recall → tweak → run) is the core play pattern and must be frictionless: history recall must preserve the full multi-command line exactly.
5. **Going big.** GALAXY runs a 300-iteration rainbow rosette. User discovers the SPEED control to slow it down for recording or crank it to instant for iteration.
6. **Saving.** File → Save Drawing (⌘S) prompts for a name and writes the *session's command list* to Terminal HD (see §8). The file appears in Documents; double-clicking it later reopens Turtle Garden and replays the drawing.
7. **Starting over.** CLEAR (typed, or the button) wipes the canvas and homes the turtle. The session command list resets too — a save always reproduces exactly what is on the canvas.

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
| `CLEAR` | `CS` | — | Wipe canvas, home the turtle, reset session command list |
| `HOME` | — | — | Jump to center, heading up, **without** drawing |

Color names: `RED ORANGE YELLOW GREEN CYAN BLUE PURPLE PINK WHITE`. A number is treated as an HSL hue (0–360, clamped).

Semantics decisions (differ from classic LOGO where kid-friendliness wins):

- `HOME` never draws. Classic LOGO draws a line home when the pen is down; that surprises beginners and ruins drawings. Documented in Help.
- `CLEAR` also homes (classic `CLEARSCREEN` behavior) and resets the saveable command list.
- Heading 0 = up (classic LOGO), `RIGHT` is clockwise.
- Numbers may be negative or fractional (`FORWARD -20`, `RIGHT 172.5`). No expressions, no variables in v1.
- The turtle may walk off-canvas; lines are simply clipped. No wrapping in v1.

### Parser behavior

- **Tokenize** on whitespace; `[` and `]` are always their own tokens even without surrounding spaces (`REPEAT 4[FD 50 RT 90]` works).
- **Recursive descent** over the token stream producing an AST: a program is a list of `{cmd, arg}` nodes and `{repeat, count, body}` nodes; `body` is itself a program, giving nesting for free. REPEAT nesting depth is unlimited in grammar; execution caps total emitted segments (see below).
- Case-insensitive throughout. Multiple commands per line. Blank input is a no-op, not an error.
- On any error, **nothing executes** — the line is all-or-nothing so a half-run never corrupts the canvas relative to the session command list.
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
- **Glow rendering.** Two stacked canvases: a persistent **trail canvas** (segments are drawn once and accumulate — no per-frame full redraw) and a transparent **overlay canvas** redrawn each frame with just the turtle sprite. Glow = each segment stroked twice on the trail canvas: a wide low-alpha pass with `shadowBlur ≈ 12` in the pen color, then a thin bright core (near-white at high lightness). This reads as neon without post-processing.
- **Rainbow mode** advances the hue ~7° per segment (per FORWARD command, not per pixel), so a 36-segment star sweeps most of the wheel.
- **Canvas resolution** matches the window's device-pixel ratio so lines stay crisp on retina displays. Logical drawing space is the window's canvas area; origin (HOME) at its center.
- **Turtle sprite:** authored pixel art (~15×15 logical px grid drawn programmatically, scaled ×2), a small green turtle with shell, head, and feet, drawn onto the overlay rotated to the current heading. Idle blink: eyes toggle briefly every ~4 s while no program is running.

## 7. Sound spec

- **One sound: the plink.** A short WebAudio note at the start of each drawn segment. Oscillator: `triangle`; gain envelope: attack 5 ms to ~0.12, exponential decay to silence over ~180 ms; a single shared `GainNode` master at 0.5 into `destination`. No samples, no external assets.
- **Pitch follows heading.** Map the turtle's heading (0–360°, normalized) onto a two-octave **major pentatonic scale** rooted at 220 Hz: `index = round(heading / 360 * 10)`, frequencies `220 · 2^(steps[index]/12)` with pentatonic steps `[0,2,4,7,9,12,14,16,19,21,24]`. Turning shapes therefore play arpeggios; a REPEAT spell becomes a melodic loop. Pentatonic guarantees nothing sounds sour.
- **Rate limit:** at most one plink per 30 ms (MAX speed would otherwise buzz). Skipped plinks are dropped, not queued.
- **Autoplay policy:** the `AudioContext` is created/resumed on the first user gesture (first Enter or button press). No sound before that; no error either.
- **Mute toggle** in the controls strip (🔊/🔇), persisted in the app's preferences. Default: sound on.

## 8. Visual spec

- **Palette.** Canvas `#0a0a12` (near-black, faint blue). Neon pen defaults to `hsl(190 100% 60%)` cyan. Glow core near-white (`75%` lightness of the pen hue). UI chrome follows the TerminalOS window style; inside the content area, a chunky inset bezel around the canvas, monospace type everywhere (the OS mono stack), dim green-on-dark for the log, amber for the hint bar, red-pink for errors (still friendly in tone).
- **Layout** (single window, default 720×560, min 520×420):
  - Canvas (fills available space, top).
  - Scrollback log: last ~4 lines of echoed commands/errors.
  - Command line: `?` prompt + text input.
  - Hint bar (one line).
  - Controls strip: spell buttons `STAR SPIRAL FLOWER GALAXY`, then `SPEED 1×/4×/MAX`, `CLEAR`, mute.
- **Spells** (exact v1 texts; SPIRAL and FLOWER deliberately demonstrate *nested* REPEAT):
  - STAR — `COLOR YELLOW REPEAT 5 [ FORWARD 150 RIGHT 144 ]`
  - SPIRAL — `RAINBOW REPEAT 60 [ REPEAT 4 [ FORWARD 100 RIGHT 90 ] RIGHT 6 ]`
  - FLOWER — `RAINBOW REPEAT 12 [ REPEAT 6 [ FORWARD 60 RIGHT 60 ] RIGHT 30 ]`
  - GALAXY — `RAINBOW REPEAT 300 [ FORWARD 230 RIGHT 151 ]`
- **Input affordances:** ArrowUp/ArrowDown command history (session-scoped); Enter runs; input keeps focus after running; clicking anywhere in the window refocuses the input.

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
			size: () => ({ w: 720, h: 560, minW: 520, minH: 420 }),
			component: () => import('$lib/apps/turtle-garden/TurtleGardenWindow.svelte')
		},
		{
			// Document window: opens a saved drawing and replays it.
			match: { kind: 'prefix', prefix: 'turtle-garden:', arg: 'fileId' },
			role: 'app',
			title: ({ args, fs }) => fs.peekNode(args.fileId)?.name ?? 'Turtle Garden',
			size: () => ({ w: 720, h: 560, minW: 520, minH: 420 }),
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
				body: 'A turtle that obeys typed commands and draws glowing lines. FORWARD 50 to start. REPEAT to go wild.'
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

**Recommendation: save drawings as replayable command-list files, not picture blobs.**

- Format: the session's successfully-executed command list, one line per submitted command, UTF-8. First line `; TURTLE GARDEN v1` as a comment/format marker (`;` lines are skipped on replay).
- Storage: `fs.createBlobFile(DOCUMENTS_ID, name, encodedBytes, { appId: 'turtle-garden', opensWith: 'turtle-garden', fileType: 'data', contentType: 'text/x-turtle-garden' })`. The blob path is required because inline-text bodies carry no `contentType`, and `contentType` is what the prefix window's `opens` claim routes on; `opensWith` makes routing explicit regardless.
- Why command-list over picture blob:
  1. It replays — reopening a drawing re-animates it, which *is* the product experience, and it invites further mutation (the code is the artifact).
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

1. Fresh install from Computer Store → launch → typing `forward 50` (lowercase) draws a visible glowing line with a plink, within one command.
2. All commands and aliases in §4 work; unknown/malformed input never executes anything and always produces a §4-style hint.
3. `REPEAT 3 [ REPEAT 4 [ FD 30 RT 90 ] RT 120 ]` draws three rotated squares — nesting is correct.
4. GALAXY spell animates without any frame taking >50 ms (no UI lockup); input stays responsive during drawing.
5. ArrowUp recalls the last line verbatim, including a spell's full text after tapping its button.
6. Speed control changes animation rate; MAX completes GALAXY in under ~2 s.
7. Mute toggle silences plinks immediately and persists across relaunch.
8. ⌘S saves a file to Documents; the file double-clicks open into a Turtle Garden window that replays the exact drawing.
9. CLEAR (typed or button) wipes canvas, homes turtle, and a subsequent save contains only post-clear commands.
10. No sound plays and no console error appears before the first user gesture.
11. `pnpm check` and `pnpm test:unit` pass; no OS-code edits outside the two registration files (`manifests.ts`, `store-data.ts`).

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
- **Manual QA script:** acceptance criteria 1–10 walked on desktop Chrome/Safari/Firefox; retina + non-retina; window resize mid-drawing (canvas must not lose the trail — either preserve via offscreen copy or accept documented clear-on-resize, decide during build and document in Help).

## 12. Risks & open questions

- **Resize behavior.** Preserving the trail bitmap across window resizes needs an offscreen copy (cheap) — but re-centering HOME changes replay geometry. Proposal: HOME is fixed at the canvas center *at drawing start*; resizing pans, never rescales. Needs a build-time decision.
- **iconKind / store icon.** The manifest `iconKind` must match an existing PixelIcon glyph and the store card needs an icon; if no turtle-ish glyph exists, either reuse `doc` or add a sprite (adding one touches shared UI — check conformance constraints first).
- **Save-menu wiring.** Menus are built at the manifest level; Save needs to reach the focused window's component (event/callback pattern — check how other apps with File menus do it before inventing one).
- **Audio on iPad/touch devices.** The audience skews touch; the plink gesture-unlock must count taps on spell buttons as gestures (it does, but verify on iOS Safari).
- **Step cap value.** 100k steps is a guess; GALAXY is 300. Validate the cap against MAX-speed frame budget on a low-end Chromebook.
- **Replay of files edited by hand** (v2 TextEdit interop): garbage lines in a saved file should degrade to per-line friendly errors on replay, not abort the whole file. V1 files are app-written only, so this is deferred but the replay loop should already be per-line tolerant.
- **Color vocabulary.** Nine names may be too few; kids will type `BLACK` (invisible on the canvas) and `BROWN`. Decide: alias BLACK→dim gray with a wink message, or error.
