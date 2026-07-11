# The Dialer — PRD

A fictional dial-up terminal for TerminalOS. You dial phone numbers, sit through a synthesized modem handshake, and land on fictional BBSes rendered as ANSI-style text terminals. Hidden phone numbers are buried in message posts and file listings; hunting them across boards leads to a secret system with a mystery payoff. Entirely offline — every system, post, and sysop is authored fiction shipped with the app.

## Overview & audience

- **What it is:** a WarGames-flavored dial-up simulator. Dial screen → modem handshake → BBS terminal. Four fictional boards plus one hidden system, connected by a breadcrumb chain of phone numbers and a login credential.
- **Audience:** retro computing enthusiasts — people who either remember 2400 baud or wish they did. Secondary: anyone who watches a screen-recording of the handshake and wants to hear it themselves.
- **Not:** a real telnet client, not networked, not LLM-driven. All content is static and deterministic. (LLM sysop chat is a v2 note, riding the existing chatrbot backend.)

## Viral hook

The handshake **is** the hook. Within ten seconds of first launch a user has: clicked DIAL on a number from a sticky note, heard DTMF tones, a ring, and a gnarly four-second carrier screech, and watched `CONNECT 2400` print onto an amber terminal. That clip is the share.

The second hook is discovery posts: "I found the secret BBS" screenshots. The breadcrumb chain is designed so the payoff screen is screenshot-worthy (a government terminal that logs your handle and implies it heard you coming) but the *route* to it isn't obvious from any single screen — people will trade hints.

## UX walkthrough

1. **Launch.** Double-click The Dialer in /Applications (or Desktop alias). One window opens: the dial screen. Black bezel, amber phosphor, a drawn telephone keypad, an input line, a DIAL button, and a Post-it-style sticky note in the corner: *"RUSTY DISKETTE BBS — 555-2323 — ask for Captain Vector"*.
2. **Dial.** User types digits (keyboard) or clicks the keypad. Each digit plays its DTMF pair. DIAL (or Enter) starts the call: dial tone was already idling; now ringback (two rings), then the handshake — answer tone, warble, screech, hiss — ~4 s total, with a status line stepping through `DIALING… / RINGING… / CARRIER DETECTED / NEGOTIATING… / CONNECT 2400`.
3. **BBS session.** The terminal clears and the board's ANSI welcome banner types in at the selected baud rate. Login is a handle prompt (persisted after first entry; boards greet you by handle on return visits). Then the main menu: `[M]essage boards [F]ile area [D]oor game [G]oodbye` (per-board variations). Single-key navigation, `Q`/`ESC` backs up one level, never dead-ends.
4. **Message boards.** Each board lists topics; each topic lists posts (author handle, date, subject); reading a post types it out at baud speed. Posts are where the lore and the breadcrumbs live.
5. **Discovering a hidden number.** In Rusty Diskette's *Grapevine* board, a post by `phracture` name-drops Night Circuit and its number. Any 7-digit string the user has *seen render on screen* is added to the in-app phonebook (a `[P]honebook` screen on the dial screen lists found numbers with names once connected). Seen-but-undialed numbers show as `?UNVERIFIED?` — a visible to-do list that drives the hunt.
6. **Dialing it.** `G`oodbye drops carrier (short click + hiss-out), returns to the dial screen. User dials the found number; new handshake; new board with its own banner, sysop voice, and boards.
7. **Payoff.** The chain (see Content spec) terminates at `555-0113` — a system that answers with a bare carrier and `LOGIN:`. Three bad attempts drops carrier. The credential is buried on The Foundry. Correct login reveals PROJECT LODESTONE: a DOE seismic-array terminal running unattended since 1983, a farewell memo from its last operator, a `VISITORS.LOG` that already contains the three sysops' handles — and then appends *yours* — and a final live line: `EVENT 0088 REGISTERED — SOURCE: INBOUND LINE (YOU)`. Cursor blinks. That's the screenshot.

## Content spec — the fictional universe

Everything is set in **area code 616, autumn 1987**. All numbers are 555-prefixed. This lore is canon; the builder agent should extend its voice, not replace it.

### 1. The Rusty Diskette — `555-2323` (starter, on the sticky note)

- **Sysop:** *Captain Vector* (Dale Kowalczyk, 41, runs it on a XT clone in his garage; smells of solder, signs every post "— CV"). Friendly, dad-joke energy, fiercely proud of his 40 MB drive.
- **Boards:** *General Chatter* (Halloween plans, a flame war about Amiga vs ST), *Trade Post* (hardware swaps — "WTB: working 1541, will trade two joysticks and a slightly haunted C64"), *The Grapevine* (rumors board — this is where breadcrumb #1 lives).
- **File area:** text files. `MODEM101.TXT`, `ANSIDRAW.TXT`, and `FOUNDRY.TXT` — an ad for The Foundry containing its number (**breadcrumb #2**).
- **Door game:** *Grim Corridor* — a 3-room text dungeon, one monster, high-score table. Deliberately tiny.
- **Grapevine breadcrumb post:** `phracture` writes that the real late-night action is on *Night Circuit* — "Mary only answers after 9PM her time, 555-8008, tell her the Captain still owes her a crystal."

### 2. Night Circuit — `555-8008`

- **Sysop:** *Mainframe Mary* (identity unknown; claims to operate from a telco central office; posts timestamped 3–5 AM only). Terse, technically flawless, allergic to hype. Board colors lean cyan/blue.
- **Boards:** *Late Shift* (insomniac chatter), *Phreak Physics* (switching-network lore, in-fiction only — no real phreaking content).
- **Breadcrumb #3:** in *Late Shift*, user `no.carrier` posts a wardial scan excerpt of the 555 exchange. Most lines read `VOICE` or `BUSY`; one reads: `5550113 → CARRIER 300bps. No banner. LOGIN prompt. Drops after 3 tries. Anyone know this one?` Mary replies: `Leave it alone.` (Which guarantees nobody leaves it alone.)
- **File area:** `SCANLOG.TXT` (the same scan, full), `MARY.FAQ` (all answers evasive).

### 3. The Foundry — `555-4477`

- **Sysop:** *Slag* (Renata Ortiz, 24, third-shift machinist and demoscene coder; ALL CAPS, zero punctuation, kind underneath). Metal/industrial aesthetic, red/grey banner.
- **Boards:** *The Floor* (shop talk), *Demo Den* (scene brags), *Old Iron* (retired big-iron war stories — **breadcrumb #4 lives here**).
- **Breadcrumb #4:** in *Old Iron*, user `wf-7` (an ex-technician) reminisces about a DOE seismic monitoring site up north that got defunded and mothballed in January '83: "…they pulled everyone out in a week. Nobody decommissioned anything. Last I knew the maintenance account still worked — OPERATOR, password CROSSTALK. The dial-in was still listed in the site binder. Probably still ringing into an empty room."
- **File area:** `.NFO`-style demo release notes; one references "wf-7's ghost-site story" so users who hit files first get pointed at the *Old Iron* board.

### 4. PROJECT LODESTONE — `555-0113` (the secret system)

- Not a BBS. Answers with bare carrier, then `LOGIN:` / `PASSWORD:`. Three failures → `NO CARRIER`. Correct: `OPERATOR` / `CROSSTALK`.
- **Inside:** a Department of Energy seismic-array terminal, station WF-9, unattended since 1983-01-14. Menu: `[S]tatus  [L]og  [M]ail  [V]isitors`.
  - *Status:* array nominal, 1,462 days unattended, tape storage 97% full.
  - *Mail:* one unsent memo from **Dr. E. Weiss**, last operator, to a colleague — half technical shutdown notes, half quiet grief about leaving the machine running: "I couldn't bring myself to power it down. It listens better than anyone I worked with."
  - *Visitors:* `VISITORS.LOG` already lists `CAPT.VECTOR 85-11-02`, `MAINFRAME.MARY 86-03-17`, `SLAG 87-06-30` — the sysops all found it and never told. The user's handle is appended live, then: `EVENT 0088 REGISTERED — SOURCE: INBOUND LINE (YOU)`. The array heard them dial in.
- **Design intent:** the payoff is atmosphere, not a prize. Melancholy + "it noticed me" beats a fireworks screen.

### The chain, summarized

sticky note → Rusty Diskette (`2323`) → Grapevine post → Night Circuit (`8008`) → Late Shift scanlog → the number `0113` (locked) → Rusty Diskette file `FOUNDRY.TXT` → The Foundry (`4477`) → Old Iron post → credential → LODESTONE payoff. Two independent entry points into the middle (Grapevine and FOUNDRY.TXT) so the hunt doesn't have a single choke point. Any unknown number dialed → `RINGING…` forever or an in-fiction voice-line/busy gag (rotate 3 canned outcomes).

## Feature list

### v1

- Dial screen: keypad (click + keyboard), sticky note, phonebook of found/verified numbers, baud selector (300/2400/9600).
- WebAudio: dial tone, per-digit DTMF, ringback, 4-phase handshake, carrier-drop sound. All gated behind user gesture; master volume + mute in prefs.
- Terminal renderer: 80×25 grid, 16-color ANSI palette, baud-simulated typing, blinking block cursor, scanline/glow styling consistent with the OS's CRT look.
- 4 boards + 1 secret system as static content modules; login-handle capture; per-board menu/board/post/file/door navigation as one shared BBS state machine driven by data.
- Number-sighting detection (any rendered 7-digit `555-XXXX` string → phonebook).
- One micro door game (Grim Corridor) with a persisted high score.
- Persistence of handle, found numbers, visited systems, read-post ids, door high score.

### Scope cuts (v2+)

- **LLM sysop live-chat:** a `[C]hat with sysop` menu item per board that opens a session against the existing chatrbot backend with a per-sysop persona prompt. Offline-first stays intact: item shows `SYSOP NOT PAGED` when no API key. v2 only.
- **Downloadable files landing on Terminal HD:** `[D]ownload` in file areas writes the text file into the user's Documents via TerminalFS with a fake XMODEM progress bar. Cut from v1 to keep the FS surface read-only-except-AppData.
- More door games, per-board new-message counters, ANSI animation in banners, a second breadcrumb chain.

## Terminal rendering spec

- **Grid:** 80×25 character cells. Implementation: a `<pre>`-based line buffer with per-run `<span>` color classes (no canvas needed; DOM text keeps it copy/paste-able for sharing). Window content scrolls internally; the OS window is fixed-size (`720×480` content area at a 9×16-ish cell).
- **Palette:** the 16 CGA/ANSI colors (`#000,#a00,#0a0,#a50,#00a,#a0a,#0aa,#aaa` + bright variants `#555,#f55,#5f5,#ff5,#55f,#f5f,#5ff,#fff`) on black. Content is authored in a tiny markup (`{Y}`, `{R}`, `{*W}` for bright, `{/}` reset) compiled to runs — do not ship raw ESC parsing in v1.
- **Typing simulation:** at 8N1, chars/sec = baud ÷ 10. 300 → 30 cps (per-char timer), 2400 → 240 cps and 9600 → 960 cps (chunked per animation frame: emit `cps × dt` chars per frame). Any keypress mid-type completes the current screen instantly (authentic and merciful). Baud selector on the dial screen and in prefs.
- **Cursor:** block `█`, 530 ms blink, always at end-of-output or at the input field.
- **Font:** the OS's existing monospace stack; no bundled fonts.

## Sound spec (WebAudio)

One `AudioContext` created on first user gesture; master `GainNode` (default 0.5) → destination. All sounds synthesized; zero audio assets.

- **Dial tone:** 350 Hz + 440 Hz sines, continuous while off-hook on the dial screen, −18 dBFS-ish (gain 0.12).
- **DTMF:** standard matrix — rows 697/770/852/941 Hz, columns 1209/1336/1477 Hz (e.g. `5` = 770+1336, `0` = 941+1336). 80 ms on, 60 ms gap, 5 ms attack/release ramps to avoid clicks.
- **Ringback:** 440 Hz + 480 Hz, compressed cadence 1.2 s on / 0.8 s off, two cycles.
- **Handshake (~4 s, four phases, scheduled on the AudioContext clock):**
  1. *Answer tone* (0.0–0.7 s): 2100 Hz sine, with a 15 Hz square-wave gain wobble (crude phase-reversal feel).
  2. *V.22 warble* (0.7–1.6 s): oscillator alternating 1200/2400 Hz every 30–40 ms (scheduled `setValueAtTime` steps), plus a quiet 550 Hz undertone.
  3. *Training screech* (1.6–3.0 s): white-noise buffer through a bandpass (center ~1800 Hz, Q≈0.8) at rising gain, overlaid with 1650 Hz and 1850 Hz tones gated on/off at ~8 Hz. This is the gnarly part; don't be shy with it.
  4. *Carrier settle* (3.0–4.2 s): broadband hiss lowpassed to ~3 kHz, gain decaying to a faint bed that persists during the session (gain ~0.02), `CONNECT 2400` prints at 3.6 s.
- **Carrier drop:** 60 ms click (short noise burst) + hiss ramp to zero over 300 ms.
- Timing constants live in one `sounds.ts` module so tests can assert the schedule without an audio device.

## TerminalOS integration spec

Per `docs/writing-an-app.md`: one manifest entry, zero-prop window components, no OS edits.

### `defineApp` sketch (`src/lib/terminalos/apps/manifests.ts`)

```ts
defineApp({
	id: 'dialer',
	name: 'The Dialer',
	fileName: 'Dialer.app',
	category: 'entertainment',
	description: 'Dial-up terminal. Four boards. Maybe more.',
	icon: '☎',
	removable: true,
	desktopAliasByDefault: false,
	isSystem: false,
	status: 'released',
	iconKind: 'floppy', // must be an existing PixelIcon glyph; add a 'phone' sprite later if wanted
	windows: [
		{
			match: { kind: 'exact', id: 'dialer' },
			role: 'app',
			title: () => 'The Dialer',
			size: () => ({ w: 720, h: 520 }),
			component: () => import('$lib/apps/dialer/DialerWindow.svelte')
		},
		{
			match: { kind: 'exact', id: 'dialer-prefs' },
			role: 'prefs',
			title: () => 'Dialer Preferences',
			size: () => ({ w: 340, h: 260 }),
			component: () => import('$lib/apps/dialer/DialerPrefs.svelte')
		}
	],
	aboutSpec: {
		title: 'The Dialer',
		version: 'v1.0',
		tagline: 'shall we place a call?',
		glyph: '☎',
		glyphBg: '#1a1206',
		glyphFg: '#ffb000',
		sections: [
			{ h: 'WHAT IT IS', body: 'A modem, a phone line, and every board in the 616 that answers.' },
			{ h: 'TIP', body: 'People post numbers they should not.' }
		]
	},
	menus: (os) => [
		{
			label: 'File',
			items: [
				{ type: 'action', label: 'Hang Up', shortcut: '⌘H', action: () => dialerBus.hangUp() },
				{ type: 'action', label: 'Close', shortcut: '⌘W', action: () => os.closeFocused() }
			]
		},
		{
			label: 'Line',
			items: [
				{ type: 'action', label: 'Phonebook…', action: () => dialerBus.showPhonebook() },
				{ type: 'action', label: 'Preferences…', shortcut: '⌘,', action: () => os.openWindow('dialer-prefs') }
			]
		},
		{ label: 'Help', items: [{ type: 'action', label: 'About The Dialer', action: () => os.openAbout('dialer') }] }
	],
	statusExtra: () => null
});
```

(`dialerBus` is a small module-level store the menu closures and the window component share — same pattern other apps use since `menus(os)` can't reach component state directly. Confirm the prevailing pattern in `manifests.ts` at build time and match it.)

### `store-data.ts` entry (`src/lib/apps/computer-store/store-data.ts`)

```ts
{
	id: 'dialer',
	cat: 'ENT',
	title: 'THE DIALER',
	pub: 'CROSSTALK SYSTEMS',
	tagline: 'Your modem misses you.',
	icon: 'phone', // or nearest existing store icon
	sticker: 'NEW',
	back: 'A 2400-baud terminal and a phone line into a town that never logged off. Four boards answer. Rumor says a fifth one does too, if you know where to look.',
	inside: ['Real handshake audio', 'Four bulletin boards', 'One number nobody posts'],
	reqs: 'Terminal OS 1.0 · Speakers on'
}
```

Plus `'dialer'` appended to `CATEGORIES.ent.appIds`.

### Source layout

```
src/lib/apps/dialer/
	DialerWindow.svelte    // dial screen + terminal, reads getAppContext()
	DialerPrefs.svelte     // baud, volume, mute, phosphor color, reset progress
	bbs-machine.ts         // pure state machine: (state, key) -> (state, output[])
	content/               // one module per system: rustydiskette.ts, nightcircuit.ts, foundry.ts, lodestone.ts
	sounds.ts              // WebAudio synthesis, exported timing constants
	persistence.ts         // load/save progress via fs AppData
```

### Persistence

**Progress goes in TerminalFS AppData; knobs go in preferences.**

- `fs.getAppDataFolder('dialer')` → write one inline-text JSON file, `progress.json`: `{ handle, foundNumbers: [], verifiedSystems: [], readPosts: [], doorHighScore, lodestoneUnlocked }`. Justification: this is user *data*, not layout — it must survive backup/restore with the disk (AppData rides the TerminalFS manifest and Terminal HD backups, per the architecture doc), and it self-heals via the AppData container. It is small and human-loseable, exactly what AppData is for. Bonus, and deliberate: also write a human-readable `PHONEBOOK.TXT` alongside it — a user browsing AppData in Finder finds an in-fiction artifact instead of opaque state.
- Baud rate, volume, mute, phosphor tint → the OS preferences layer with the prefs dialog, matching how other apps store display knobs. These are device/session taste, not progress; losing them costs nothing.
- Never localStorage directly; never new storage layers.

## Acceptance criteria

1. Fresh install → launch → sticky note visible; dialing `555-2323` plays DTMF + ring + handshake and lands on Rusty Diskette's banner within ~6 s of pressing DIAL.
2. Audio never plays before a user gesture; mute silences everything including the session hiss bed.
3. Every menu screen on every board accepts its listed keys, and `Q`/`ESC` from any depth eventually reaches `Goodbye` → dial screen. No unreachable states, no dead ends (asserted by a state-machine walk test).
4. Reading the `phracture` Grapevine post adds `555-8008` to the phonebook as unverified; connecting to Night Circuit flips it to named/verified.
5. The full chain is completable: a scripted test drives sticky-note → 2323 → post → 8008 → scanlog → 4477 → wf-7 post → 0113 + `OPERATOR`/`CROSSTALK` → LODESTONE visitors screen showing the user's handle appended.
6. Three bad logins at 0113 drops carrier; the number stays in the phonebook.
7. Kill the tab mid-session → relaunch: handle, phonebook, read posts, high score all restored from AppData; baud/volume restored from prefs.
8. Typing speed matches baud: at 300, a 900-char screen takes ~30 s unless skipped; keypress skip completes it instantly.
9. Unknown numbers produce one of the canned no-connect outcomes and return control; the app never soft-locks in a call.
10. App uninstall/reinstall leaves progress intact (AppData persists unless the user resets in prefs).

## Test plan

- **`app-conformance.test.ts` / `zero-os-edit.test.ts`:** must pass untouched — the app is a manifest entry + components, zero OS edits. Conformance also validates the `iconKind` choice.
- **Unit — `bbs-machine.test.ts`:** the machine is pure `(state, input) → (state, outputs)`, so: exhaustive reachability walk over all four systems (every screen reachable, every screen can reach exit); breadcrumb assertions (the rendered output of specific posts contains the expected numbers/credentials); phonebook sighting logic; LODESTONE login attempt counting; full-chain script (AC #5).
- **Unit — `sounds.test.ts`:** timing constants sanity (DTMF matrix correct pairs, handshake phases contiguous and ≈4 s) without instantiating AudioContext; synthesis functions accept an injected context so a mock can assert scheduling calls.
- **Unit — `persistence.test.ts`:** round-trip progress through a real in-memory TerminalFS (`getAppDataFolder`), corrupt-JSON recovery (bad file → fresh progress, file rewritten), PHONEBOOK.TXT regeneration.
- **Component smoke (vitest + testing-library):** DialerWindow mounts under a mocked AppContext, renders dial screen, dial → connected transition with sound module stubbed.
- **Manual:** audio quality pass on Safari + Chrome (AudioContext resume rules differ), baud feel at all three rates, full playthrough.

## Risks & open questions

- **Audio autoplay policies:** Safari suspends AudioContext aggressively; every entry point into sound must go through a resume-if-suspended guard. Mitigation: single `ensureAudio()` gate, tested manually on Safari.
- **Handshake quality is the product.** Synthesized-from-scratch screech can sound cheap. Budget real tuning time; the spec's phase plan is a floor, not a ceiling. If it can't get gnarly enough with oscillators, a short generated-at-build-time buffer (still no shipped asset) is an acceptable fallback.
- **Menu-to-component bridge:** `menus(os)` closures need to poke window state (Hang Up, Phonebook). Confirm the repo's prevailing pattern (module store vs os-level event) before inventing one.
- **Icon:** no telephone `iconKind` sprite exists; shipping with `'floppy'` is fine but weak. Adding a `phone` glyph touches shared `PixelIcon` — decide whether that counts as an OS edit worth making (it's additive and other apps could use it).
- **Spoiler half-life:** one chain, one payoff — solvable in ~15 minutes once hints circulate. Acceptable for v1 (the handshake carries replay), but v2 should add a second, harder chain.
- **Open:** should Grim Corridor's high score post to a fictional cross-board leaderboard (pure flavor, static + your score)? Cheap, cute, undecided.
- **Open:** window resizing — fixed 80×25 is authentic; decide whether the OS window is fixed-size or the grid letterboxes.
