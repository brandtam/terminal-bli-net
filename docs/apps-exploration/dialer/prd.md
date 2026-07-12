# The Dialer — PRD

A dial-up terminal for TerminalOS. You dial phone numbers, sit through a synthesized modem handshake, and land on BBSes rendered as ANSI-style text terminals. Four authored fictional boards seed the world — but the boards are **real**: messages persist server-side, other users' posts show up on the same boards you read, files can be uploaded and downloaded, and `[W]ho's online` lists actual callers connected right now. Hidden phone numbers are buried in posts and file listings; hunting them across boards leads to a secret system with a mystery payoff.

## Overview & audience

- **What it is:** a late-'80s dial-up simulator wrapped around a real, living community. Dial screen → modem handshake → BBS terminal. Four boards plus one hidden system, connected by a breadcrumb chain — and on every board, real users posting alongside the authored fiction.
- **Audience:** retro computing enthusiasts — people who either remember 2400 baud or wish they did. Secondary: anyone who watches a screen-recording of the handshake and wants to hear it themselves. Tertiary, and new: people who stay because someone answered their post.
- **Not:** a real telnet client, not federated, not LLM-driven content. The canon lore is static and deterministic; the community layer is real users under moderation.

## Viral hook

The handshake **is** the hook. Within ten seconds of first launch a user has: clicked DIAL on a number from a sticky note, heard DTMF tones, a ring, and a gnarly four-second carrier screech, and watched `CONNECT 2400` print onto an amber terminal. That clip is the share.

The second hook is discovery posts: "I found the secret BBS" screenshots. The breadcrumb chain is designed so the payoff screen is screenshot-worthy but the *route* to it isn't obvious from any single screen — people will trade hints. And now they can trade them **on the boards themselves**, which is exactly how it worked.

The third hook is the community being real: `You are caller #1,042. Last caller: SLAG.` — except sometimes the last caller is a real person, and they left you a message.

## UX walkthrough

1. **Launch.** Double-click The Dialer in /Applications (or Desktop alias). One window opens: the dial screen. Black bezel, amber phosphor, a drawn telephone keypad, an input line, a DIAL button, and a Post-it-style sticky note in the corner: *"RUSTY DISKETTE BBS — 555-2323 — ask for Captain Vector"*.
2. **Dial.** User types digits (keyboard) or clicks the keypad. Each digit plays its DTMF pair. DIAL (or Enter) starts the call: dial tone was already idling; now ringback (two rings), then the handshake — answer tone, warble, screech — ~4 s total, with a status line stepping through `DIALING… / RINGING… / CARRIER DETECTED / NEGOTIATING… / CONNECT 2400`. Occasionally the line is `BUSY` (boards have one phone line); the dialer offers auto-redial.
3. **First login.** The terminal clears and the board's ANSI welcome banner types in at the selected baud rate. New callers get the classic interrogation: pick a handle, set a password, answer a short new-user questionnaire (in-fiction flavor questions). Returning callers get `handle:` / `password:` and a greet-by-name. Then the caller counter: `You are caller #1,042. Last caller: PHRACTURE.`
4. **Main menu.** `[M]essage boards [F]ile area [D]oor game [W]ho's online [C]hat [Y]ell for sysop [G]oodbye` (per-board variations). Single-key navigation, `Q`/`ESC` backs up one level, never dead-ends. A status line shows `Time remaining today: 44 min`.
5. **Message boards.** Each board lists topics; each topic lists posts (author handle, date, subject); reading a post types it out at baud speed. Canon posts carry the lore and breadcrumbs; real users' posts appear right next to them. `[P]ost` composes a reply or new topic in an in-terminal line editor.
6. **File area.** Listings with name, size, uploader, download count. `[D]ownload` runs a fake XMODEM transfer (progress bar at baud speed) and delivers the file; `[U]pload` accepts `.txt`/`.md` (and small images, dithered on upload). Upload/download ratio enforced: upload 1 to unlock 3 downloads.
7. **Who's online / chat.** `[W]ho` lists callers connected to this board right now, with idle times. `[C]hat` joins the board's node channel — line-based, typed out at baud like everything else.
8. **Discovering a hidden number.** In Rusty Diskette's *Grapevine* board, a canon post by `phracture` name-drops Night Circuit and its number. Any 7-digit string the user has *seen render on screen* is added to the in-app phonebook — including numbers real users post. Seen-but-undialed numbers show as `?UNVERIFIED?` — a visible to-do list that drives the hunt.
9. **The Autodialer.** From the dial screen, `[A]utodial` opens an exchange sweeper: pick a 100-number block of the 555 exchange (e.g. `555-01xx`), and it dials through it with compressed per-call audio (~1.5 s each), printing `VOICE / BUSY / NO ANSWER / CARRIER` line by line. Results persist as `SCANLOG.TXT` in the phonebook screen; carriers found are added as `?UNVERIFIED?`. One block per day — scanning the whole exchange takes commitment, and knowing *where* to scan still comes from the boards.
10. **Payoff.** The chain (see Content spec) terminates at `555-0113` — a system that answers with a bare carrier and `LOGIN:`. Three bad attempts drops carrier. The credential is buried on The Foundry. Correct login reveals PROJECT LODESTONE: a DOE seismic-array terminal running unattended since 1983, a farewell memo from its last operator, a `VISITORS.LOG` that already contains the three sysops' handles — and then appends *yours* — and a final live line: `EVENT 0088 REGISTERED — SOURCE: INBOUND LINE (YOU)`. Cursor blinks. That's the screenshot.

## Content spec — the fictional universe

Everything is set in **area code 616, autumn 1987**. All numbers are 555-prefixed. This lore is canon; the builder agent should extend its voice, not replace it. Canon posts are seeded into the same store real posts live in, pinned and immutable, so one render path serves both.

### 1. The Rusty Diskette — `555-2323` (starter, on the sticky note)

- **Sysop:** *Captain Vector* (Dale Kowalczyk, 41, runs it on a XT clone in his garage; smells of solder, signs every post "— CV"). Friendly, dad-joke energy, fiercely proud of his 40 MB drive.
- **Boards:** *General Chatter* (Halloween plans, a flame war about Amiga vs ST), *Trade Post* (hardware swaps — "WTB: working 1541, will trade two joysticks and a slightly haunted C64"), *The Grapevine* (rumors board — this is where breadcrumb #1 lives).
- **File area:** text files. `MODEM101.TXT`, `ANSIDRAW.TXT`, and `FOUNDRY.TXT` — an ad for The Foundry containing its number (**breadcrumb #2**).
- **Door game:** *Grim Corridor* — a 3-room text dungeon, one monster, high-score table. Deliberately tiny.
- **Grapevine breadcrumb post:** `phracture` writes that the real late-night action is on *Night Circuit* — "Mary only answers after 9PM her time, 555-8008, tell her the Captain still owes her a crystal."
- **The Back Room:** Rusty Diskette's hidden elite area lives here (see below).

### 2. Night Circuit — `555-8008`

- **Sysop:** *Mainframe Mary* (identity unknown; claims to operate from a telco central office; posts timestamped 3–5 AM only). Terse, technically flawless, allergic to hype. Board colors lean cyan/blue.
- **Boards:** *Late Shift* (insomniac chatter), *Phreak Physics* (switching-network lore, in-fiction only — no real phreaking content).
- **Breadcrumb #3:** in *Late Shift*, user `no.carrier` posts an exchange-sweep excerpt of the 555 exchange. Most lines read `VOICE` or `BUSY`; one reads: `5550113 → CARRIER 300bps. No banner. LOGIN prompt. Drops after 3 tries. Anyone know this one?` Mary replies: `Leave it alone.` (Which guarantees nobody leaves it alone. It also teaches the user that exchange sweeps are a thing — and the app has an Autodialer.)
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
- LODESTONE is **entirely static** — no posting, no files, no chat. The one place in the app nobody else can touch is the empty room.
- **Design intent:** the payoff is atmosphere, not a prize. Melancholy + "it noticed me" beats a fireworks screen.

### The Back Room — the hidden elite area

Every real board had an "elite" section you had to earn or be told about. The temptation and the hunt are the feature; the payoff is a wink.

- **Getting in:** a *General Chatter* canon post jokes that the Captain "keeps the good stuff in the back — ask him about the WEATHER." Typing `WEATHER` at Rusty Diskette's main menu opens the gate: `THE BACK ROOM — MEMBERS ONLY. WHO SENT YOU?` — any answer works; the Captain pretends to check a list either way.
- **Inside:** the Captain's private stash — the best ANSI art in the 616, `CRASHLOG.TXT` (the legendary story of the night the 40 MB drive died and came back), his award-losing chili recipe (`CHILI.TXT`), and a sysop note: "YOU'RE ONE OF US NOW. DON'T POST THE WORD. — CV". No uploads, no posting — static canon only.
- **Design intent:** the payoff of digging for the members-only area is warmth, not treasure — you were let in on the joke, and it lands *because* the buildup is played straight.

### The chain, summarized

sticky note → Rusty Diskette (`2323`) → Grapevine post → Night Circuit (`8008`) → Late Shift scanlog → the number `0113` (locked) → Rusty Diskette file `FOUNDRY.TXT` → The Foundry (`4477`) → Old Iron post → credential → LODESTONE payoff. Two independent entry points into the middle (Grapevine and FOUNDRY.TXT), and the Autodialer as a third, slower path to *finding* carriers (never credentials). Any unknown number dialed → one of three canned no-connect outcomes (endless ring, busy, an in-fiction voice-line gag).

## The community layer — real boards, real callers

This is the load-bearing change from the original concept: the boards are a real, shared, persistent space. Design principles:

- **The fiction absorbs the infrastructure.** Moderation is "the sysop cleans up overnight." Rate limits are "you have 45 minutes a day." Identity is a handle and password, like every real BBS. Nothing breaks character.
- **Canon and community share one surface.** Seeded canon posts are pinned rows in the same store; real posts thread underneath and around them. Breadcrumb posts are immutable so the hunt can't be vandalized.
- **Identity:** handle + password, claimed on first call (D1-backed, salted hash). A session token is kept in AppData so returning callers auto-fill. No email, no accounts UI, no recovery in v1 — lose your password, register a new handle; that's period-correct too.
- **Moderation, two layers:**
  1. **Flag-on-write:** every post/upload passes an LLM moderation check (riding the existing chatrbot backend seam) before it's visible. Rejects are refused in-fiction: `THE SYSOP HAS SUSPENDED POSTING PRIVILEGES FOR THIS MESSAGE.`
  2. **Nightly sweep:** a Workers cron trigger re-audits the day's content, hard-deletes anything flagged, prunes orphans, and posts a canon-voiced sysop note when it removed things ("took out the trash. — CV").
- **Rate limits as fiction:** daily connect-time budget (45 min, resets midnight), post cooldown (60 s), 3 uploads/day, one sweep block/day. All enforced server-side per handle.
- **Graceful degradation:** if the API is unreachable, boards fall back to canon-only content with a `LOCAL MODE — LINE NOISE ON THE TRUNK` banner. The single-player spine (chain, LODESTONE, door game, Back Room) works fully offline.

## Feature list — v1, all of it

- Dial screen: keypad (click + keyboard), sticky note, phonebook of found/verified numbers, baud selector (300/2400/9600), busy signals + auto-redial.
- WebAudio: dial tone, per-digit DTMF, ringback, busy cadence, 4-phase handshake, carrier-drop sound. All gated behind user gesture; master volume + mute in prefs. **No persistent hiss bed** — the line goes clean after `CONNECT`.
- Terminal renderer: 80×25 grid, 16-color ANSI palette, baud-simulated typing, blinking block cursor, scanline/glow styling consistent with the OS's CRT look.
- 4 boards + Back Room + LODESTONE; canon content seeded, real posting/reading on all public boards.
- New-user questionnaire, handle + password, caller counter, last-caller display, greet-by-name.
- Message boards: topics, threaded posts, in-terminal line editor, post cooldown, LLM flag-on-write.
- File areas: upload/download of `.txt`/`.md` and small images (forced 1-bit/CGA dither on upload, ≤64 KB post-dither, R2-backed); fake XMODEM progress bars at baud speed; upload/download ratio (1:3). No video, no audio files.
- `[W]ho's online` + per-board node chat (Durable Object per board; WebSocket).
- `[Y]ell for sysop` — v1 answers with a canon-voiced canned response after a believable delay; the LLM live-sysop upgrade is a fast-follow riding the same menu item.
- The Autodialer: one 100-number sweep/day, compressed audio, persisted `SCANLOG.TXT`, carriers → phonebook.
- Number-sighting detection (any rendered 7-digit `555-XXXX` string → phonebook), including numbers in real users' posts.
- Daily time limit with on-screen countdown; warnings at 10 and 1 minutes; `TIME'S UP — CALL BACK TOMORROW` + carrier drop.
- One micro door game (Grim Corridor) with a persisted high-score table (server-side, per-board top 10 — real users compete).
- Persistence of handle/session, found numbers, verified systems, read-post ids, scanlogs, door high score.

### Explicitly out (v2+)

- LLM sysop live-chat (menu item ships v1 with canned responses; live persona chat is the first fast-follow).
- Downloaded files landing on Terminal HD via TerminalFS (v1 downloads render in-terminal / save to AppData only).
- Inter-board echomail, more door games, a second breadcrumb chain, ANSI animation in banners.

## Terminal rendering spec

- **Grid:** 80×25 character cells. Implementation: a `<pre>`-based line buffer with per-run `<span>` color classes (no canvas needed; DOM text keeps it copy/paste-able for sharing). Window content scrolls internally; the OS window is fixed-size (`720×480` content area at a 9×16-ish cell).
- **Palette:** the 16 CGA/ANSI colors (`#000,#a00,#0a0,#a50,#00a,#a0a,#0aa,#aaa` + bright variants `#555,#f55,#5f5,#ff5,#55f,#f5f,#5ff,#fff`) on black. Content is authored in a tiny markup (`{Y}`, `{R}`, `{*W}` for bright, `{/}` reset) compiled to runs — do not ship raw ESC parsing in v1. User posts are plain text (markup escaped) — only canon content gets color.
- **Typing simulation:** at 8N1, chars/sec = baud ÷ 10. 300 → 30 cps (per-char timer), 2400 → 240 cps and 9600 → 960 cps (chunked per animation frame: emit `cps × dt` chars per frame). Any keypress mid-type completes the current screen instantly (authentic and merciful). Baud selector on the dial screen and in prefs.
- **Cursor:** block `█`, 530 ms blink, always at end-of-output or at the input field.
- **Font:** the OS's existing monospace stack; no bundled fonts.

## Sound spec (WebAudio)

One `AudioContext` created on first user gesture; master `GainNode` (default 0.5) → destination. All sounds synthesized; zero audio assets.

- **Dial tone:** 350 Hz + 440 Hz sines, continuous while off-hook on the dial screen, −18 dBFS-ish (gain 0.12).
- **DTMF:** standard matrix — rows 697/770/852/941 Hz, columns 1209/1336/1477 Hz (e.g. `5` = 770+1336, `0` = 941+1336). 80 ms on, 60 ms gap, 5 ms attack/release ramps to avoid clicks.
- **Ringback:** 440 Hz + 480 Hz, compressed cadence 1.2 s on / 0.8 s off, two cycles. **Busy:** 480 Hz + 620 Hz, 0.5 s on / 0.5 s off.
- **Handshake (~4 s, four phases, scheduled on the AudioContext clock):**
  1. *Answer tone* (0.0–0.7 s): 2100 Hz sine, with a 15 Hz square-wave gain wobble (crude phase-reversal feel).
  2. *V.22 warble* (0.7–1.6 s): oscillator alternating 1200/2400 Hz every 30–40 ms (scheduled `setValueAtTime` steps), plus a quiet 550 Hz undertone.
  3. *Training screech* (1.6–3.0 s): white-noise buffer through a bandpass (center ~1800 Hz, Q≈0.8) at rising gain, overlaid with 1650 Hz and 1850 Hz tones gated on/off at ~8 Hz. This is the gnarly part; don't be shy with it.
  4. *Carrier settle* (3.0–4.5 s): broadband hiss lowpassed to ~3 kHz, gain decaying **to zero** — `CONNECT 2400` prints at 3.6 s and the line is silent by 4.5 s. No persistent session hiss.
- **Carrier drop:** 60 ms click (short noise burst) + hiss ramp to zero over 300 ms.
- **Autodialer:** compressed call montage per number — 200 ms DTMF burst, then one of: half a ring, busy blip, 300 ms carrier chirp. ~1.5 s per number.
- Timing constants live in one `sounds.ts` module so tests can assert the schedule without an audio device.

## Backend spec (Cloudflare)

The site already deploys via `adapter-cloudflare` with `wrangler.jsonc`; the backend is bindings plus SvelteKit server routes — **zero OS edits**, keeping the "apps are manifest + components" rule intact. The Dialer is the first app with a server side; the pattern to establish: everything under `/api/dialer/*`, nothing app-specific in shared OS code.

- **D1** (`dialer-db`): the system of record.
  - `callers` (handle PK, pass_hash, created_at, last_seen, calls, minutes_today, uploads_today, ratio_credits, questionnaire json)
  - `posts` (id, board, topic, author, body, created_at, canon flag, pinned flag, flagged flag, deleted_at)
  - `files` (id, board, name, kind, size, uploader, body_text nullable, r2_key nullable, downloads, flagged, deleted_at)
  - `scores` (board, handle, score, created_at)
  - `sightings` are client-side (phonebook lives in AppData) — the server never needs to know what you've found.
- **R2** (`dialer-files`): dithered image bodies only; text/md live inline in D1.
- **Durable Objects** (`BoardNode`, one per board): WebSocket presence + node chat + caller counter. Chat is ephemeral — history dies with the socket, like a real node.
- **Cron trigger** (nightly): moderation re-audit, hard-delete flagged content, reset daily budgets, prune expired sessions, emit the sysop cleanup post when warranted.
- **Moderation seam:** flag-on-write calls the existing chatrbot backend's moderation path; if it's down, writes queue as `flagged` (hidden) rather than failing open.
- **Auth:** handle + password → salted hash in D1; opaque session token returned, stored in AppData, sent as a header. All rate limits enforced server-side per handle.

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
	back: 'A 2400-baud terminal and a phone line into a town that never logged off. Four boards answer — and the callers are real. Rumor says a fifth board answers too, if you know where to look.',
	inside: ['Real handshake audio', 'Live boards, real callers', 'One number nobody posts'],
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
	content/               // canon seeds, one module per system: rustydiskette.ts, nightcircuit.ts, foundry.ts, lodestone.ts, backroom.ts
	api.ts                 // typed client for /api/dialer/*, offline fallback logic
	chat.ts                // BoardNode WebSocket client
	autodialer.ts          // sweep scheduling + result persistence
	sounds.ts              // WebAudio synthesis, exported timing constants
	persistence.ts         // load/save local progress via fs AppData

src/routes/api/dialer/   // +server.ts endpoints: auth, boards, posts, files, scores
src/lib/server/dialer/   // D1 queries, moderation seam, DO class, cron handler
```

### Persistence

**Local progress in TerminalFS AppData; knobs in preferences; shared content in D1.**

- `fs.getAppDataFolder('dialer')` → `progress.json`: `{ handle, sessionToken, foundNumbers: [], verifiedSystems: [], readPosts: [], scanlogs: [], lodestoneUnlocked }`. This is user *data* — it survives backup/restore with the disk and self-heals via the AppData container. Bonus, and deliberate: also write a human-readable `PHONEBOOK.TXT` alongside it — a user browsing AppData in Finder finds an in-fiction artifact instead of opaque state.
- Baud rate, volume, mute, phosphor tint → the OS preferences layer with the prefs dialog. Device/session taste, not progress.
- Posts, files, scores, identity → D1/R2 (see Backend spec). Never localStorage directly; never new client storage layers.

## Acceptance criteria

1. Fresh install → launch → sticky note visible; dialing `555-2323` plays DTMF + ring + handshake and lands on Rusty Diskette's banner within ~6 s of pressing DIAL.
2. Audio never plays before a user gesture; mute silences everything; after `CONNECT` the line is silent (no persistent hiss).
3. Every menu screen on every board accepts its listed keys, and `Q`/`ESC` from any depth eventually reaches `Goodbye` → dial screen. No unreachable states, no dead ends (asserted by a state-machine walk test).
4. Reading the `phracture` Grapevine post adds `555-8008` to the phonebook as unverified; connecting to Night Circuit flips it to named/verified. Numbers rendered from *real users'* posts are sighted the same way.
5. The full chain is completable: a scripted test drives sticky-note → 2323 → post → 8008 → scanlog → 4477 → wf-7 post → 0113 + `OPERATOR`/`CROSSTALK` → LODESTONE visitors screen showing the user's handle appended.
6. Three bad logins at 0113 drops carrier; the number stays in the phonebook.
7. New-user flow claims a handle + password; a second session with those credentials is greeted by name and sees the caller counter incremented.
8. A post made in one session is visible from a different session/user on the same board; a post that fails moderation is refused in-fiction and never visible to others.
9. Upload `.txt` → appears in the file area, downloadable by another user with an XMODEM progress bar at baud speed; image upload is dithered and ≤64 KB stored; a 4th upload in a day is refused in-fiction; download of a 4th file with no uploads is blocked by the ratio message.
10. Two sessions on the same board see each other in `[W]ho's online` and can exchange chat lines; disconnect removes the caller from the list.
11. Autodialer: sweeping a 100-block produces a persisted `SCANLOG.TXT`, found carriers enter the phonebook as unverified, and a second block the same day is refused (`ONE SWEEP A NIGHT. THE PHONE COMPANY NOTICES.`).
12. Daily time limit: countdown visible, warnings at 10/1 min, expiry drops carrier; resets at midnight server time.
13. `WEATHER` at Rusty Diskette's menu opens the Back Room gate; the area is static (no post/upload options render) and unreachable from any listed menu.
14. Typing speed matches baud: at 300, a 900-char screen takes ~30 s unless skipped; keypress skip completes it instantly.
15. Unknown numbers produce one of the canned no-connect outcomes and return control; the app never soft-locks in a call.
16. With the API unreachable, boards render canon-only in `LOCAL MODE`, and the full chain (AC #5) still completes offline.
17. Kill the tab mid-session → relaunch: handle/session, phonebook, read posts, scanlogs restored from AppData; baud/volume restored from prefs. App uninstall/reinstall leaves progress intact.

## Test plan

- **`app-conformance.test.ts` / `zero-os-edit.test.ts`:** must pass untouched — the app is a manifest entry + components + its own API routes, zero OS edits. Conformance also validates the `iconKind` choice.
- **Unit — `bbs-machine.test.ts`:** the machine is pure `(state, input) → (state, outputs)`, so: exhaustive reachability walk over all systems (every screen reachable, every screen can reach exit); breadcrumb assertions (the rendered output of specific canon posts contains the expected numbers/credentials); phonebook sighting logic (incl. markup-escaped user posts); LODESTONE login attempt counting; Back Room gate logic; full-chain script (AC #5) in offline mode.
- **Unit — `sounds.test.ts`:** timing constants sanity (DTMF matrix correct pairs, handshake phases contiguous and ≈4 s, settle gain ends at zero) without instantiating AudioContext; synthesis functions accept an injected context so a mock can assert scheduling calls.
- **Unit — `persistence.test.ts`:** round-trip progress through a real in-memory TerminalFS (`getAppDataFolder`), corrupt-JSON recovery (bad file → fresh progress, file rewritten), PHONEBOOK.TXT regeneration.
- **Server — `api.test.ts` (vitest + miniflare/wrangler test env):** auth round-trip, post visibility + flag path, ratio + daily-budget enforcement, canon rows immutable, cron sweep deletes flagged rows and resets budgets.
- **Component smoke (vitest + testing-library):** DialerWindow mounts under a mocked AppContext + mocked api client, renders dial screen, dial → connected transition with sound module stubbed; LOCAL MODE fallback renders when the api client rejects.
- **Manual:** audio quality pass on Safari + Chrome (AudioContext resume rules differ), baud feel at all three rates, two-browser chat/presence session, full playthrough, one moderation red-team pass (try to post junk, upload a non-dithered image, script rapid posts).

## Risks & open questions

- **User-generated content is the big new risk.** Two moderation layers + no-fail-open + static-only Back Room and LODESTONE contain it, but a launch-week red-team pass is mandatory, and the kill switch (force LOCAL MODE globally via a flag) should exist from day one.
- **Handle squatting / no recovery:** v1 has no email or reset. Acceptable (period-correct), but reserve the canon handles (`CAPT.VECTOR`, `MAINFRAME.MARY`, `SLAG`, `PHRACTURE`, `NO.CARRIER`, `WF-7`, `E.WEISS`, `OPERATOR`) server-side so nobody impersonates the fiction.
- **Audio autoplay policies:** Safari suspends AudioContext aggressively; every entry point into sound must go through a resume-if-suspended guard. Mitigation: single `ensureAudio()` gate, tested manually on Safari.
- **Handshake quality is the product.** Synthesized-from-scratch screech can sound cheap. Budget real tuning time; the spec's phase plan is a floor, not a ceiling. If it can't get gnarly enough with oscillators, a short generated-at-build-time buffer (still no shipped asset) is an acceptable fallback.
- **Menu-to-component bridge:** `menus(os)` closures need to poke window state (Hang Up, Phonebook). Confirm the repo's prevailing pattern (module store vs os-level event) before inventing one.
- **First app with a server side:** `/api/dialer/*` + `src/lib/server/dialer/` sets the precedent for every future networked app. Worth a short ADR when built (app-owned API routes, bindings named per-app, zero shared-OS coupling).
- **Icon:** no telephone `iconKind` sprite exists; shipping with `'floppy'` is fine but weak. Adding a `phone` glyph touches shared `PixelIcon` — decide whether that counts as an OS edit worth making (it's additive and other apps could use it).
- **Spoiler half-life:** one chain, one payoff — solvable in ~15 minutes once hints circulate. Softer now: the boards being real means the *community* is the replay loop, and the Autodialer gives completionists a long tail. v2 can add a second, harder chain.
- **Open:** should Grim Corridor's high score post to a cross-board leaderboard? Now that scores are server-side and real users compete, probably yes — decide at build time.
- **Open:** window resizing — fixed 80×25 is authentic; decide whether the OS window is fixed-size or the grid letterboxes.
