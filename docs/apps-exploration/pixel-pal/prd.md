# Pixel Pal — PRD

A virtual pet that lives on the Terminal desktop. An egg hatches into a chunky 16×16 creature that blinks, bounces, naps, gets hungry, and chirps in 8-bit. It evolves over real days based on how well you treat it, remembers you between sessions, sleeps when your clock says night, and sulks if ignored.

A working interactive demo of the full creature, animation, sound, and stat systems lives next to this document: `demo.html` (single file, no dependencies, open from `file://`). The demo is the visual and behavioral reference for everything below — when this PRD and the demo disagree on feel, the demo wins.

## Overview & audience

Target user: kids and young teens who grew up on touchscreens and are poking around a retro computer for the first time. Design constraint that follows from this: **every interaction must be discoverable with zero reading.** No manual, no tutorial text, no settings page in v1. The rules:

- Care verbs are four big labeled buttons with glyphs: FEED, PLAY, CLEAN, LIGHTS. Nothing is hidden behind menus (menus duplicate the buttons, they never gate anything).
- State is communicated by the creature itself (face, posture, particles) plus three segmented meters with icons, not numbers or text.
- The only text prompt in the whole app is a pulsing "TAP THE EGG" bubble on first run, which disappears forever after hatch.
- Wrong inputs get a cute response, not an error: feeding a full pet makes it shake its head; pressing PLAY when exhausted makes it yawn; care buttons dim while it sleeps.
- Nothing dies and nothing is unrecoverable. Neglect changes what the pet becomes; it never ends the game.

## Viral hook

Personality moments worth clipping. Two mechanisms:

1. **Surprise moments.** Every 20–40 seconds of idle time the pet does something unprompted: zoomies across the screen, chases a bug that wanders in, dances with music notes, sneezes itself off the ground. A screen recording of any 60-second window catches at least one. These are unlisted and untriggerable — you can't make them happen, which is why people record waiting for them.
2. **Shareable outcomes.** Evolution branches are visibly dramatic and tied to care quality. A loved pal turns golden and tufty; an ignored one turns olive-green and permanently unimpressed ("my pal turned into THIS"). The reveal is a flash-frame evolution animation worth capturing.

## UX walkthrough

1. **Install.** User buys Pixel Pal in the Computer Store (free/cheap tier), installs from My Shelf, gets `Pixel Pal.app` in /Applications and a desktop alias. Double-click opens one fixed window styled as a handheld toy: screen on top, three meters, four buttons.
2. **Egg.** The screen shows an egg on a sunny ground. It wobbles on its own every few seconds with a soft blip. "TAP THE EGG" pulses over it. Taps (on the canvas or any button) wobble it harder and advance visible cracks.
3. **Hatch.** After ~3 taps (or ~10 minutes untouched — the egg always hatches), cracks reach stage 3, the screen flashes white, a fanfare plays (C5–E5–G5–C6), and the baby appears mid-hop with hearts. `born` timestamp is set. Total time from first open to living creature: under 15 seconds if the user taps.
4. **Daily care loop.** The pet idles: bounces slowly, blinks, waddles to random spots. Meters decay over real hours. FEED drops a cookie it walks to and eats in visible bites (crumbs, nom sounds). PLAY drops a ball it bops back into the air three times. CLEAN sweeps sparkles across the ground, clearing dirt blobs that accumulate. LIGHTS toggles night: screen dims, pet curls up, pixel Z's float, energy recharges. At night by the real clock (21:00–07:00 local) the scene shows moon and stars and the pet yawns, nudging the user toward LIGHTS. Low hunger or happiness shows a sulky half-lidded face and occasional sad chirps. Closing the app is fine — state persists, and reopening after time away shows the consequences (hungrier pet, dirt, or a well-rested one if it slept). Returning after >1 minute away triggers a welcome-back dance.
5. **Evolution reveal.** At each stage threshold (48h, then 120h of age, plus a minimum accumulated care score so the clock alone can't do it), the pet stops, the screen strobes, a rising arpeggio plays, and the pet reappears as its next form — form chosen by care quality. Hearts and a "!" punctuate it. The moment takes ~3 seconds and cannot be skipped: it is the clip.

## Creature design spec

### Sprite system

Everything is data, no image files. A frame is 16 strings of 16 characters; each character indexes a palette:

| char | meaning | base hex |
|---|---|---|
| `.` | transparent | — |
| `o` | outline | `#4a3222` |
| `b` | body | `#f5a15c` |
| `l` | belly | `#ffe9c0` |
| `w` | eye white / shine | `#fff9ea` |
| `e` | pupil | `#33221a` |
| `k` | cheek blush | `#ef7d57` |
| `f` | feet | `#c9713d` |
| `m` | mouth | `#7a3b2e` |
| `s` | egg spot | `#e8c890` |

Frames are **composed, not duplicated**: a body POSE (full 16×16 grid with a 3-row face slot at `faceAt`) plus a FACE (3 rows of 16 spliced in). This is the demo's exact mechanism and it must be kept — it yields every animation state from 3 poses × 7 faces instead of 21 hand-drawn frames. Authoritative pixel grids for all poses, faces, egg, cracks, and props (heart, Z, note, sparkle, cookie, ball, bug, dirt, exclaim) are in `demo.html` between the `SPRITES` / `END SPRITES` markers; copy them verbatim into `sprites.ts`.

Poses: `tall` (standing), `squash` (1px shorter — the other half of every bounce/waddle cycle), `jump` (feet tucked, drawn with a y offset). Faces: `open`, `blink`, `happy`, `eatopen`, `eatchew`, `sleep`, `sulk`.

Named animation states (state → pose/face sequence, all at the 140ms animation tick):

| state | frames | recipe |
|---|---|---|
| `idle` | 2 | tall/squash alternate every 3 ticks; random `blink` face 2 ticks |
| `walk` | 2 | tall/squash every tick, x ±1/tick, flip by direction |
| `eat` | 2×N | eatopen/eatchew alternate; a bite (cookie shrinks 2 rows, crumbs, nom tone) every 4 ticks |
| `happy`/`dance` | 4 | jump/squash + happy face, direction flips, note particles |
| `sleep` | 2 | tall/squash every 6 ticks (breathing) + sleep face, Z particle every ~3s |
| `sulk` | 2 | squash + sulk face, turned away, gray Z drips |
| `zoomies` | 2 | tall/squash every tick, x ±4/tick, 4 wall-to-wall passes, dust |
| `sneeze` | 3 | squash/blink wind-up 4 ticks → jump/eatopen burst + "!" |
| `hatch` | — | egg wobble (x offsets −1,+1,0) + 3 crack overlays + 8-tick white strobe |
| `evolve` | — | jump/squash strobe 16 ticks, form swap at tick 8 |
| `nope` | 2 | tall + sulk face, direction flips every 2 ticks |
| `wake` | 2 | jump + happy face 3 ticks, then idle |

### Evolution stages and branches

Six forms total. Later stages reuse the same poses/faces with **top-row replacements** (ear/silhouette changes) and **palette swaps** — the demo's `STAGE2_TOP` + `BRANCH_PAL` mechanism, extended with one more tier.

| stage | age gate | care gate | forms |
|---|---|---|---|
| 1 Blob | hatch → 48h | — | Blob (base orange) |
| 2 Junior | 48h | careScore ≥ 12 | **Sunny** (quality ≥ 0.6: golden `#ffc95c`, taller ears) / **Grump** (quality < 0.6: olive `#a8b56b`, taller ears, sulk as default face) |
| 3 Adult | 120h | careScore ≥ 30 | **Radiant** (Sunny + quality ≥ 0.6: gold + crown tuft rows) / **Doodle** (mixed paths: base orange + one bent ear) / **Feral** (Grump + quality < 0.4: darker olive, permanent half-lid eyes, still lovable) |

`quality` = rolling average of (hunger + happiness + energy)/300 sampled hourly since last evolution. If the care gate isn't met when the age gate passes, evolution waits for it — you cannot clock-skip to an adult. Reaching a "bad" form is reversible in spirit: care quality resets per tier, so a Grump raised well becomes a Doodle, not a Feral.

### Stat model

Three stats, 0–100. Decay per real hour:

| stat | awake | asleep | notes |
|---|---|---|---|
| hunger | −8/h | −3/h | at 0, happiness decay doubles; pet sulks periodically |
| happiness | −4/h | 0 | −8/h while hunger = 0 or dirt ≥ 2 |
| energy | −5/h | **+20/h** | at <10, PLAY refused with a yawn |

Care effects (applied instantly on press so the meter visibly jumps): FEED +30 hunger (refused with `nope` above 90), PLAY +25 happiness / −10 energy, CLEAN +10 happiness if dirt existed. Dirt: one blob may spawn per 4 awake hours, max 3 on screen. careScore: +1 per effective care action, **credited at most 4/hour** so button-mashing doesn't count as parenting.

Sleep is either manual (LIGHTS) or scheduled: while the app is closed the pet is assumed asleep 21:00–07:00 local.

**Offline catch-up.** On window mount:

```
elapsed = now - lastSeen
if elapsed < 0: lastSeen = now; return        // clock rolled back: no decay, no credit
elapsed = min(elapsed, 48h)                   // absence cap: never a wall of zeros
for each wall-clock hour chunk in [lastSeen, lastSeen + elapsed]:
    asleep = lightsWereOff || hourIn(21:00–07:00 local)
    apply that chunk's decay/regen rates (fractional chunks scale linearly)
dirt += min(floor(awakeHours / 4), 3 - dirt)
```

Pure function, unit-tested (see Test plan). The demo implements the same shape with minute-scale rates.

## Feature list

**v1:** egg + hatch; one creature line, 3 stages, 6 forms; FEED/PLAY/CLEAN/LIGHTS; three segmented meters with low-state blink; dirt; real-clock night scene; sleep/energy regen; 4 surprise moments (zoomies, bug chase, dance, sneeze); tap-the-pet hearts; WebAudio chirps + mute; TerminalFS persistence with offline catch-up and clock-tamper guards; evolution reveal; welcome-back dance.

**Scope cuts (v2):** pet roams the desktop outside its window (needs a chromeless overlay window and OS-level z-order thought — design doc first); a real minigame behind PLAY; `statusExtra` menu-bar badge when hungry; naming the pal; share-card PNG export of the current form; multiple pals / trading.

## Sound spec

WebAudio only, oscillator + gain envelope (`exponentialRampToValueAtTime` to 0.001), created lazily after the first user gesture; every tone is skipped while muted. Mute is a labeled toggle and persists.

| event | notes (Hz) | step | wave | gain |
|---|---|---|---|---|
| egg wobble | A3 220 | 60ms | triangle | .12 |
| hatch fanfare | C5 E5 G5 C6 — 523, 659, 784, 1047 | 100ms | square | .10 |
| eat (per bite) | G3 E3 — 196, 165 | 80ms | triangle | .14 |
| happy | E5 G5 B5 — 659, 784, 988 | 70ms | square | .10 |
| sad/sulk | G4 E4 C4 — 392, 330, 262 | 160ms | triangle | .10 |
| sleep | C5 G4 E4 — 523, 392, 330 | 220ms | sine | .08 |
| wake | E4 C5 E5 — 330, 523, 659 | 80ms | square | .10 |
| clean sparkle | E6 G6 A6 — 1319, 1568, 1760 | 60ms | square | .06 |
| zoomies | C5 E5 G5 C6 G5 C6 | 60ms | square | .10 |
| ball bop n | 880 + 120·n | 70ms | square | .10 |
| nope | A3, rest, A3 | 90ms | triangle | .12 |
| evolve | G4 C5 E5 G5 C6 E6 | 90ms | square | .10 |

## Visual spec

- World canvas: **64×48 logical pixels**, scaled to fill the window width with `image-rendering: pixelated`. Every drawn coordinate is integer-rounded — no anti-aliased fractions.
- Scene palette: day sky `#eee0b0`, day ground `#d0a868`; night sky `#39395c`, night ground `#5a4a58`, stars `#e8e0c0`; sun `#f4c33c`. Lights-off adds a `rgba(18,18,40,.45)` overlay under the particles so Z's stay bright.
- Shell: warm cream plastic bezel (`#f7e3b2`→`#e8ca8c`, `#4a3222` borders), chunky rounded buttons with a hard 4px drop shadow that compresses on press.
- Meters: 10 segments each, 2px borders; hunger orange `#f5883c`, happiness pink `#ef6a8a`, energy yellow `#f4c33c`; ≤2 segments blinks red.
- Window content size: ~320×470 CSS px (screen + meters + buttons). Fixed, not resizable.

## TerminalOS integration spec

New files: `src/lib/apps/pixel-pal/PixelPalWindow.svelte` (window, zero props, reads `getAppContext()`), `pet-model.ts` (pure state machine: decay, catch-up, evolution — no DOM, no Svelte), `sprites.ts` (grids + palettes from the demo), `sound.ts` (tone/jingle table). Plus one entry each in `manifests.ts` and `store-data.ts`. No OS files change — that is the whole point of the manifest model, and `zero-os-edit.test.ts` will hold us to it.

### `defineApp` sketch (`src/lib/terminalos/apps/manifests.ts`)

```ts
defineApp({
	id: 'pixel-pal',
	name: 'Pixel Pal',
	fileName: 'Pixel Pal.app',
	category: 'games',
	description: 'A little creature that lives in your computer',
	icon: '🥚',
	removable: true,
	desktopAliasByDefault: true,
	isSystem: false,
	status: 'released',
	iconKind: 'tv', // placeholder — see open questions; must be an existing PixelIcon glyph
	windows: [
		{
			match: { kind: 'exact', id: 'pixel-pal' },
			role: 'app',
			title: () => 'Pixel Pal',
			size: () => ({ w: 320, h: 470 }),
			component: () => import('$lib/apps/pixel-pal/PixelPalWindow.svelte')
		}
	],
	aboutSpec: {
		title: 'Pixel Pal',
		version: 'v1.0',
		tagline: 'it lives in here now',
		glyph: '🥚',
		glyphBg: 'var(--paper-soft)',
		glyphFg: 'var(--ink)',
		sections: [{ h: 'WHAT IT IS', body: 'A pet made of pixels. Feed it. It remembers.' }]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }]
		},
		// Pal menu mirrors the buttons — discoverability lives in the buttons,
		// the menu exists so the app behaves like every other Terminal app.
		{
			label: 'Help',
			items: [{ type: 'action', label: 'About Pixel Pal', action: () => os.openAbout('pixel-pal') }]
		}
	],
	statusExtra: () => null
});
```

**Chromeless decision: no.** The manifest supports `chromeless` (Stickies uses it), but this window keeps standard OS chrome. Reasons: (1) the target user is learning the OS — the one close box and title bar they've just learned must work here too; (2) chromeless means reimplementing drag/close/focus inside the app for no gain; (3) the toy look is fully achievable inside the content area (the demo proves it). Chromeless becomes relevant only for the v2 desktop-roaming overlay, which is its own design.

The Pal menu (Feed/Play/Clean/Lights actions) needs the window's component state; wire it through the same module-level pet store the window renders from — `menus(os)` may read a plain module store (same pattern the docs allow for `title`/`size`).

### Store entry (`src/lib/apps/computer-store/store-data.ts`)

```ts
{
	id: 'pixel-pal',
	cat: 'GAMES',
	title: 'PIXEL PAL',
	pub: 'HATCHWORKS',
	tagline: 'It knows when you leave.',
	icon: 'pixel-pal',
	sticker: 'NEW',
	back: 'An egg comes with the disk. What hatches is up to you. Feed it, play with it, clean up after it, turn the lights off at a reasonable hour. It grows into what your care deserves — come back in a week and see who you both became.',
	inside: ['One (1) egg', 'Three evolution stages', 'Consequences'],
	reqs: 'Terminal OS 1.0 · a little kindness'
}
```

Plus `'pixel-pal'` appended to the GAMES category's `appIds`.

### Persistence plan

**Decision: one TerminalFS AppData JSON file** — `fs.getAppDataFolder('pixel-pal')` then `createTextFile(folderId, 'pet.json', json)` on first save and `fs.writeText(fileId, json)` after. Why AppData over window preferences/localStorage: the pet **is** a save file, not a UI setting — it must survive and travel with the disk (backup/restore covers AppData; localStorage preferences are a separate store per ADRs), it's a single ~300-byte document written atomically, and it's inspectable in Finder under `/System/AppData/pixel-pal/`, which fits the OS fiction ("my pet literally lives on the disk"). The only localStorage-side preference is nothing in v1 — even mute goes in `pet.json` so the file is the whole truth.

Schema (versioned):

```json
{
	"v": 1, "mode": "egg|alive", "stage": 1, "branch": null,
	"hunger": 80, "happiness": 80, "energy": 90,
	"careScore": 0, "careCreditHour": 0, "qualitySamples": [],
	"born": 0, "lastSeen": 0, "dirt": [], "lights": false, "muted": false
}
```

Write cadence: on every care action, on evolution, debounced 30s while open, and on window destroy. Load + catch-up on mount. Unknown `v` → treat as fresh egg but rename the old file to `pet.json.bak` rather than overwrite.

**Clock tampering:** `elapsed < 0` → no decay, reset `lastSeen` (moving the clock back never punishes). Forward jumps are capped at 48h of catch-up, and evolution needs `careScore`, which only real interactions produce — so setting the clock to next year yields a hungry Blob, not a free Adult. Repeated small back-and-forth tampering is not detected in v1 (accepted; see risks).

## Acceptance criteria

1. Fresh install → open: egg wobbles unprompted within 3s; three taps hatch it; creature idles (bounce + blink) within 15s of first open. Untouched, the egg still hatches by 10 minutes.
2. All four buttons produce a visible animation, an audible tone (after first gesture, unless muted), and a meter change (or a characterful refusal) — no dead presses in any state.
3. Reload the OS: pet reappears with identical stage/branch/meters, minus correct catch-up decay for time away; return after >1 minute triggers the welcome-back dance.
4. Set system clock back a day, reload: stats unchanged. Set it forward a year, reload: decay equals exactly the 48h cap, stage unchanged if care gate unmet.
5. With the window open and idle, a surprise moment occurs within any 60s observation window.
6. Between 21:00 and 07:00 local the scene is night (moon/stars) and the pet yawns; LIGHTS off recharges energy at +20/h equivalent.
7. Raising the pet with quality ≥ 0.6 to 48h produces Sunny; neglecting it produces Grump; both via the strobe reveal.
8. `pnpm check` clean; `app-conformance.test.ts` and `zero-os-edit.test.ts` pass with zero OS-file diffs; app appears in the Computer Store, installs, and launches only when owned.
9. Every canvas pixel is crisp at any window scale (integer draw coordinates + `image-rendering: pixelated`).

## Test plan

- **Guardrails (existing):** `app-conformance.test.ts` (window routes, component loads, valid `iconKind`), `zero-os-edit.test.ts` (no OS edits). Run untouched.
- **`pet-model.test.ts` (new, pure unit tests):**
  - decay: exact per-hour rates awake vs asleep; hunger-0 doubles happiness decay; floors at 0, ceilings at 100.
  - catch-up: piecewise night crossing (e.g. 18:00 → 09:00 away applies 3h awake + 10h asleep + 2h awake); 48h cap; `elapsed < 0` is a no-op that resets `lastSeen`; dirt accrual cap.
  - care: FEED refused above 90; PLAY refused under 10 energy; careScore credit capped at 4/hour under button spam.
  - evolution: age gate alone insufficient without care gate; branch thresholds at quality 0.6/0.4 boundaries (test both sides); quality sampling resets per tier; Grump→Doodle recovery path.
  - serialization: round-trip of the v1 schema; unknown version → fresh egg + `.bak`.
- **`sprites.test.ts`:** every pose/face/prop grid is rectangular at its declared size; every non-`.` char exists in the palette; every named animation state resolves to real frames.
- **Manual script:** the acceptance list above, plus mute persistence and sound-before-gesture silence (no autoplay warnings in console).

## Risks & open questions

- **`iconKind`** must be an existing `PixelIcon` glyph (conformance-tested). None of the current glyphs says "creature/egg." Options: ship with the closest existing glyph, or add an `egg` glyph to the shared PixelIcon set — that is a change to shared OS-adjacent code and needs owner sign-off first. **Open.**
- **Menus reaching component state.** The Pal menu actions need the live pet store. Module-level store is the sanctioned pattern, but confirm it doesn't fight the window-host cache on close/reopen. **Open — check `window-host-cache.ts` behavior.**
- **Background simulation.** v1 simulates only while the window is open; a closed window means the pet is "asleep or away," reconciled by catch-up. If the app should idle-animate on the desktop while closed, that's the v2 roaming design, not a v1 patch.
- **Clock micro-tampering** (repeated small rollbacks to freeze decay) is accepted in v1 — the reward is avoiding hunger in a game with no death.
- **Real-day pacing risk:** 48h to first evolution may lose impatient kids. Mitigation lever is in one constant; consider a 24h first gate after playtesting. Decide with data, not upfront.
- **Audio policy:** all tones are gated on a user gesture; verify no `AudioContext` warning fires on OS boot with the window restored from a previous session.
- **Store pricing/tier** for a kid-facing app is a storefront decision, not made here.
