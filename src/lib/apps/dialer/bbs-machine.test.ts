import { describe, it, expect } from 'vitest';
import {
	canonFiles,
	canonTopics,
	connect,
	deliver,
	entryEcho,
	inputKind,
	step,
	REG_QUESTIONS,
	type MachineResponse,
	type MachineState,
	type StepResult
} from './bbs-machine';
import type { LiveFile, LivePost, LiveTopic } from './api';
import { CANON_SYSTEMS } from './content';
import { RUSTY_DISKETTE } from './content/rusty-diskette';
import { NIGHT_CIRCUIT } from './content/night-circuit';
import { FOUNDRY } from './content/foundry';
import { LODESTONE } from './content/lodestone';
import type { CanonSystem } from './content/types';
import { plainText } from './terminal';

/**
 * All keys the walk tries on every screen — every listed command letter,
 * digits, the composer's slash commands, and the control keys.
 */
const KEYS = [
	'm',
	'f',
	'g',
	'q',
	'n',
	'p',
	'r',
	's',
	'a',
	'd',
	't',
	'i',
	'u',
	'w',
	'c',
	'y',
	'/',
	'1',
	'2',
	'3',
	'9',
	'Enter',
	'Backspace'
];

/**
 * Line-input screens make the state space (screen × entry) — the walk keys on
 * both, and prunes entries longer than two characters: every canon list fits
 * in two digits and every composer command is two characters, so longer
 * buffers reach nothing new. `tries` and `mode` are in the key so the
 * three-strikes and degradation paths get walked too. Free-text payloads
 * (typed handles, titles, filenames, buffered editor lines) are normalized
 * out of the key — their *content* never changes which screen an input leads
 * to, and leaving them in makes the space explode combinatorially.
 */
function stateKey(s: MachineState): string {
	const screen: Record<string, unknown> = { ...s.screen };
	if (typeof screen.handle === 'string') screen.handle = '·';
	if (typeof screen.title === 'string') screen.title = '·';
	if (typeof screen.name === 'string') screen.name = '·';
	// Blank and non-blank buffered lines behave differently (/S refuses an
	// all-blank body), so the normalization keeps that bit per line.
	if (Array.isArray(screen.lines)) {
		screen.lines = (screen.lines as string[]).map((line) => (line ? 'x' : '')).join(',');
	}
	if (typeof screen.compose === 'object' && screen.compose !== null) {
		const compose = screen.compose as { lines: string[]; title: string | null };
		screen.compose = {
			lines: compose.lines.map((line) => (line ? 'x' : '')).join(','),
			title: compose.title === null ? null : '·'
		};
	}
	return JSON.stringify({ screen, entry: s.entry, tries: s.tries, mode: s.mode });
}

/** Editor screens accumulate lines; one buffered line explores every branch. */
function bufferedLines(s: MachineState): number {
	return 'lines' in s.screen && Array.isArray(s.screen.lines) ? s.screen.lines.length : 0;
}

const WALK_TOPIC: LiveTopic = {
	id: 101,
	slug: null,
	section: 'general',
	title: 'REAL CALLER WAS HERE',
	author: 'PHREAK.99',
	createdAt: 1_784_000_000,
	postCount: 1,
	lastPostAt: 1_784_000_000,
	canon: false,
	pinned: false
};

const WALK_FILE: LiveFile = {
	id: 'file-1',
	name: 'REAL.TXT',
	kind: 'txt',
	size: 10,
	uploader: 'PHREAK.99',
	downloads: 0,
	createdAt: 1_784_000_000,
	canon: false
};

const WALK_POST: LivePost = {
	id: 1,
	author: 'PHREAK.99',
	body: 'a real post',
	createdAt: 1_784_000_000,
	canon: false
};

/** Every outcome the window could feed a wait screen — walked as edges. */
function responsesFor(state: MachineState): MachineResponse[] {
	switch (state.screen.id) {
		case 'auth-wait':
			return [
				{ kind: 'login', result: 'ok', handle: 'PHREAK.99' },
				{ kind: 'login', result: 'no-carrier' },
				{ kind: 'login', result: 'local' },
				{ kind: 'register', result: 'ok', handle: 'FRESH.99' },
				{ kind: 'register', result: 'refused', message: 'TAKEN' },
				{ kind: 'register', result: 'local' }
			];
		case 'sections-wait':
		case 'topics-refresh':
			return [
				{ kind: 'topics', result: 'ok', topics: [WALK_TOPIC] },
				{ kind: 'topics', result: 'no-carrier' },
				{ kind: 'topics', result: 'local' }
			];
		case 'read-wait':
			return [
				{ kind: 'posts', result: 'ok', posts: [WALK_POST] },
				{ kind: 'posts', result: 'ok', posts: [] },
				{ kind: 'posts', result: 'no-carrier' },
				{ kind: 'posts', result: 'local' }
			];
		case 'post-wait':
			return [
				{ kind: 'submit', result: 'ok' },
				{ kind: 'submit', result: 'ok', held: true },
				{ kind: 'submit', result: 'refused', message: 'COOLDOWN' },
				{ kind: 'submit', result: 'no-carrier' },
				{ kind: 'submit', result: 'local' }
			];
		case 'files-wait':
			return [
				{ kind: 'files', result: 'ok', files: [WALK_FILE] },
				{ kind: 'files', result: 'no-carrier' },
				{ kind: 'files', result: 'local' }
			];
		case 'file-dl-wait':
			return [
				{ kind: 'download', result: 'ok', file: WALK_FILE, body: 'hello' },
				{ kind: 'download', result: 'ok', file: { ...WALK_FILE, kind: 'png' }, body: null },
				{ kind: 'download', result: 'refused', message: 'RATIO' },
				{ kind: 'download', result: 'no-carrier' },
				{ kind: 'download', result: 'local' }
			];
		case 'upload-wait':
			return [
				{ kind: 'upload', result: 'ok' },
				{ kind: 'upload', result: 'ok', held: true },
				{ kind: 'upload', result: 'refused', message: 'DUPLICATE' },
				{ kind: 'upload', result: 'aborted' },
				{ kind: 'upload', result: 'no-carrier' },
				{ kind: 'upload', result: 'local' }
			];
		case 'door-score-wait':
			return [
				{ kind: 'scores', result: 'ok', scores: [] },
				{ kind: 'scores', result: 'no-carrier' },
				{ kind: 'scores', result: 'local' }
			];
		case 'yell-wait':
			return [{ kind: 'yell' }];
		default:
			return [];
	}
}

/**
 * Exhaustively walk the machine: from every seed, press every key on every
 * discovered (screen, entry, tries, mode) node, and feed every plausible api
 * outcome to every wait screen. Returns the expanded node set plus edges.
 */
function walk(system: CanonSystem, seeds: MachineState[]) {
	const seen = new Map<string, MachineState>(seeds.map((s) => [stateKey(s), s]));
	const expanded = new Set<string>();
	const edges = new Map<string, Set<string>>();
	const frontier = [...seeds];
	while (frontier.length > 0) {
		const state = frontier.pop()!;
		const from = stateKey(state);
		if (expanded.has(from) || state.entry.length > 2 || bufferedLines(state) > 1) continue;
		expanded.add(from);
		if (!edges.has(from)) edges.set(from, new Set());
		const nexts = [
			...KEYS.map((key) => step(state, key, system).state),
			...responsesFor(state).map((response) => deliver(state, response, system).state)
		];
		for (const next of nexts) {
			const to = stateKey(next);
			edges.get(from)!.add(to);
			if (!seen.has(to)) {
				seen.set(to, next);
				frontier.push(next);
			}
		}
	}
	return { seen, expanded, edges };
}

/** Assert that every expanded node can reach an 'ended' screen (no dead ends). */
function assertReachesGoodbye(result: ReturnType<typeof walk>) {
	const { seen, expanded, edges } = result;
	const reversed = new Map<string, Set<string>>();
	for (const [from, tos] of edges) {
		for (const to of tos) {
			if (!reversed.has(to)) reversed.set(to, new Set());
			reversed.get(to)!.add(from);
		}
	}
	const ended = [...seen.entries()].filter(([, s]) => s.screen.id === 'ended').map(([k]) => k);
	const canEnd = new Set(ended);
	const queue = [...ended];
	while (queue.length > 0) {
		const node = queue.pop()!;
		for (const prev of reversed.get(node) ?? []) {
			if (!canEnd.has(prev)) {
				canEnd.add(prev);
				queue.push(prev);
			}
		}
	}
	for (const key of expanded) expect(canEnd.has(key), `stuck at ${key}`).toBe(true);
}

function drive(
	state: MachineState,
	keys: string[],
	system: CanonSystem = RUSTY_DISKETTE
): StepResult {
	let result: StepResult = { state, prints: [] };
	for (const key of keys) {
		result = step(result.state, key, system);
	}
	return result;
}

/** Type a whole line and press Enter, like a caller would. */
function typeLine(
	state: MachineState,
	text: string,
	system: CanonSystem = RUSTY_DISKETTE
): StepResult {
	return drive(state, [...text.split(''), 'Enter'], system);
}

function text(result: StepResult): string {
	return plainText(result.prints.join('\n'));
}

// ── LOCAL MODE (canon-only, the offline spine) ──────────────────────────────

describe('connect (local)', () => {
	it('prints the banner and the LOCAL MODE notices, then gates on any key', () => {
		const { state, prints } = connect(RUSTY_DISKETTE);
		expect(state.handle).toBe('GUEST');
		expect(state.mode).toBe('local');
		expect(state.screen).toEqual({ id: 'pause' });
		const t = plainText(prints.join('\n'));
		expect(t).toContain('THE RUSTY DISKETTE BBS');
		expect(t).toContain('LOCAL MODE');
		expect(t).toContain('BROWSING AS GUEST');
		expect(t).toContain('PRESS ANY KEY');
	});

	it('builds the canon topic view — one render path for both modes', () => {
		const { state } = connect(RUSTY_DISKETTE);
		const topics = state.topics!;
		expect(topics).toHaveLength(RUSTY_DISKETTE.sections.flatMap((s) => s.topics).length);
		expect(topics.every((t) => t.canon && t.pinned && t.id < 0)).toBe(true);
		const grapevine = topics.filter((t) => t.section === 'grapevine');
		expect(grapevine.map((t) => t.slug)).toEqual(['night-circuit', 'exchange-rumor']);
	});

	it('builds the canon file view with the seed migration ids', () => {
		const { state } = connect(RUSTY_DISKETTE);
		const files = state.files!;
		expect(files.map((f) => f.name)).toEqual(RUSTY_DISKETTE.files.map((f) => f.name));
		expect(files[0].id).toBe(`canon:rusty-diskette:${RUSTY_DISKETTE.files[0].name}`);
		expect(files.every((f) => f.canon)).toBe(true);
	});
});

describe('reachability (acceptance #3: no dead ends)', () => {
	// Local walk: seeded at connect plus the Back Room (its code word is a
	// whole typed English word the key alphabet can't spell).
	const localSeeds = [
		connect(RUSTY_DISKETTE).state,
		drive(connect(RUSTY_DISKETTE).state, [' ', ...'weather'.split('')]).state
	];
	const local = walk(RUSTY_DISKETTE, localSeeds);

	it('reaches every local screen type', () => {
		const ids = new Set([...local.seen.values()].map((s) => s.screen.id));
		for (const id of [
			'pause',
			'menu',
			'sections',
			'topics',
			'read',
			'files',
			'file-view',
			'door',
			'yell-wait',
			'backroom-gate',
			'backroom',
			'backroom-file',
			'ended'
		])
			expect(ids, `screen ${id}`).toContain(id);
	});

	it('reaches every section, topic, post, file, and back-room file of the content', () => {
		const screens = [...local.seen.values()].map((s) => s.screen);
		RUSTY_DISKETTE.sections.forEach((sec, si) => {
			sec.topics.forEach((topic, ti) => {
				const topicId = -(si * 100 + ti + 1);
				topic.posts.forEach((_, pi) => {
					expect(
						screens.some(
							(s) => s.id === 'read' && s.section === si && s.topicId === topicId && s.post === pi
						),
						`${sec.slug}/${topic.slug} post ${pi}`
					).toBe(true);
				});
			});
		});
		RUSTY_DISKETTE.files.forEach((_, fi) => {
			expect(screens.some((s) => s.id === 'file-view' && s.file === fi)).toBe(true);
		});
		RUSTY_DISKETTE.backRoom!.files.forEach((_, fi) => {
			expect(screens.some((s) => s.id === 'backroom-file' && s.file === fi)).toBe(true);
		});
	});

	it('every expanded local state can reach goodbye', () => {
		assertReachesGoodbye(local);
	});

	it('every expanded online state can reach goodbye (canned api outcomes)', () => {
		// Seeds: fresh online connect, plus the two upload states the walk's
		// alphabet can't spell a valid filename into.
		const files = filesOnline();
		const uploadKind = typeLine(files, 'u');
		const textBody = typeLine(step(uploadKind.state, 't', RUSTY_DISKETTE).state, 'NOTES.TXT');
		const imageWait = typeLine(step(uploadKind.state, 'i', RUSTY_DISKETTE).state, 'ART.PNG');
		const online = walk(RUSTY_DISKETTE, [connectOnline(), textBody.state, imageWait.state]);
		const ids = new Set([...online.seen.values()].map((s) => s.screen.id));
		for (const id of [
			'login-handle',
			'auth-wait',
			'menu',
			'sections',
			'topics',
			'read',
			'compose-title',
			'compose-body',
			'post-wait',
			'files',
			'files-wait',
			'file-dl-wait',
			'upload-kind',
			'upload-name',
			'upload-body',
			'upload-wait',
			'chat',
			'door',
			'door-score-wait',
			'yell-wait',
			'ended'
		])
			expect(ids, `screen ${id}`).toContain(id);
		assertReachesGoodbye(online);
	});

	it('every expanded LODESTONE state can reach the drop (three strikes or [Q])', () => {
		const loggedIn = secretMenu();
		const lodestone = walk(LODESTONE, [connect(LODESTONE).state, loggedIn]);
		const ids = new Set([...lodestone.seen.values()].map((s) => s.screen.id));
		for (const id of ['secret-login', 'secret-password', 'secret-menu', 'ended'])
			expect(ids, `screen ${id}`).toContain(id);
		assertReachesGoodbye(lodestone);
	});
});

describe('local navigation', () => {
	it('q backs up one level at a time (topics are picked by number + Enter)', () => {
		const start = connect(RUSTY_DISKETTE).state;
		// any-key → menu, M → sections, 1 → topics, "1"⏎ → read, then q q q → menu
		let result = drive(start, [' ', 'm', '1', '1', 'Enter']);
		expect(result.state.screen.id).toBe('read');
		result = drive(result.state, ['q']);
		expect(result.state.screen.id).toBe('topics');
		result = drive(result.state, ['q']); // Q acts on the keypress, no Enter needed
		expect(result.state.screen.id).toBe('sections');
		result = drive(result.state, ['q']);
		expect(result.state.screen).toEqual({ id: 'menu' });
	});

	it('unlisted keys are ignored on single-key screens', () => {
		const { state } = drive(connect(RUSTY_DISKETTE).state, [' ', 'm']);
		expect(state.screen.id).toBe('sections');
		const result = step(state, 'z', RUSTY_DISKETTE);
		expect(result.state).toBe(state);
		expect(result.prints).toEqual([]);
	});

	it('Enter binds nothing on single-key screens (safe pure-skip key)', () => {
		const { state } = drive(connect(RUSTY_DISKETTE).state, [' ']);
		const result = step(state, 'Enter', RUSTY_DISKETTE);
		expect(result.state).toBe(state);
		expect(result.prints).toEqual([]);
	});

	it('goodbye hangs up', () => {
		const { state } = drive(connect(RUSTY_DISKETTE).state, [' ']);
		const result = step(state, 'g', RUSTY_DISKETTE);
		expect(result.hangup).toBe(true);
		expect(result.state.screen).toEqual({ id: 'ended' });
	});

	it('n/p page through a topic and announce the end', () => {
		const start = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '1', '1', 'Enter']);
		expect(text(start)).toContain('(1/3)');
		let result = step(start.state, 'n', RUSTY_DISKETTE);
		expect(text(result)).toContain('(2/3)');
		result = step(result.state, 'n', RUSTY_DISKETTE);
		result = step(result.state, 'n', RUSTY_DISKETTE);
		expect(text(result)).toContain('END OF TOPIC');
	});

	it('an out-of-range topic number answers NO SUCH TOPIC', () => {
		const topics = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '1']);
		const result = typeLine(topics.state, '9');
		expect(text(result)).toContain('NO SUCH TOPIC');
		expect(result.state.screen.id).toBe('topics');
	});

	it('posting is refused in-fiction without a live line', () => {
		const topics = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '1']);
		const result = drive(topics.state, ['p']);
		expect(text(result)).toContain('POSTING NEEDS A LIVE LINE');
		expect(result.state.screen.id).toBe('topics');
	});

	it('uploads and chat are refused in-fiction without a live line', () => {
		const files = drive(connect(RUSTY_DISKETTE).state, [' ', 'f']);
		expect(files.state.screen.id).toBe('files');
		const upload = drive(files.state, ['u']);
		expect(text(upload)).toContain('UPLOADS NEED A LIVE LINE');
		const menu = drive(upload.state, ['q']);
		const chat = drive(menu.state, ['c']);
		expect(text(chat)).toContain('CHAT NEEDS A LIVE LINE');
		expect(chat.state.screen).toEqual({ id: 'menu' });
	});

	it("[W]ho's online answers honestly in local mode", () => {
		const result = drive(connect(RUSTY_DISKETTE).state, [' ', 'w']);
		expect(text(result)).toContain('JUST YOU AND THE MOON');
		expect(result.state.screen).toEqual({ id: 'menu' });
	});
});

describe('breadcrumbs render on screen (acceptance #4 groundwork)', () => {
	it("the Grapevine phracture post shows Night Circuit's number", () => {
		const topics = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '3']);
		const read = typeLine(topics.state, '1');
		expect(text(read)).toContain('555-8008');
	});

	it("FOUNDRY.TXT shows The Foundry's number", () => {
		const files = drive(connect(RUSTY_DISKETTE).state, [' ', 'f']);
		const result = typeLine(files.state, '3');
		expect(text(result)).toContain('FOUNDRY.TXT');
		expect(text(result)).toContain('555-4477');
	});

	it("Night Circuit's sweep excerpt and SCANLOG.TXT both surface 555-0113", () => {
		const topics = drive(connect(NIGHT_CIRCUIT).state, [' ', 'm', '1'], NIGHT_CIRCUIT);
		const read = typeLine(topics.state, '2', NIGHT_CIRCUIT);
		expect(text(read)).toContain('5550113');
		expect(text(read)).toContain('anyone know this one?');

		const files = drive(connect(NIGHT_CIRCUIT).state, [' ', 'f'], NIGHT_CIRCUIT);
		const scanlog = typeLine(files.state, '1', NIGHT_CIRCUIT);
		expect(text(scanlog)).toContain('5550113');
	});

	it("Mary's reply guarantees nobody leaves it alone", () => {
		const topics = drive(connect(NIGHT_CIRCUIT).state, [' ', 'm', '1'], NIGHT_CIRCUIT);
		let read = typeLine(topics.state, '2', NIGHT_CIRCUIT);
		read = drive(read.state, ['n'], NIGHT_CIRCUIT);
		expect(text(read)).toContain('Leave it alone.');
	});

	it("The Foundry's Old Iron post hands over OPERATOR / CROSSTALK", () => {
		const topics = drive(connect(FOUNDRY).state, [' ', 'm', '3'], FOUNDRY);
		const read = typeLine(topics.state, '1', FOUNDRY);
		expect(text(read)).toContain('OPERATOR');
		expect(text(read)).toContain('CROSSTALK');
	});

	it("The Foundry's file area points file-first callers at Old Iron", () => {
		const files = drive(connect(FOUNDRY).state, [' ', 'f'], FOUNDRY);
		const nfo = typeLine(files.state, '1', FOUNDRY);
		expect(text(nfo)).toContain('GHOST SITE STORY');
		expect(text(nfo)).toContain('OLD IRON');
	});
});

describe('the Back Room (acceptance #13)', () => {
	it('WEATHER typed at the menu opens the gate; any answer opens the door', () => {
		const menu = drive(connect(RUSTY_DISKETTE).state, [' ']);
		const gate = drive(menu.state, [...'weather'.split('')]);
		expect(gate.state.screen).toEqual({ id: 'backroom-gate' });
		expect(text(gate)).toContain('MEMBERS ONLY');
		expect(text(gate)).toContain('WHO SENT YOU?');

		const inside = typeLine(gate.state, 'the captain sent me');
		expect(inside.state.screen).toEqual({ id: 'backroom' });
		expect(text(inside)).toContain("YOU'RE ONE OF US NOW");
		expect(text(inside)).toContain('CRASHLOG.TXT');
	});

	it('the gate word is case-insensitive and survives the [W]ho printout', () => {
		// W is also [W]ho's online — the who list prints and the word keeps going.
		const menu = drive(connect(RUSTY_DISKETTE).state, [' ']);
		const gate = drive(menu.state, [...'WeAtHeR'.split('')]);
		expect(gate.state.screen).toEqual({ id: 'backroom-gate' });
	});

	it('the area is static: read-only, no post or upload commands render', () => {
		const menu = drive(connect(RUSTY_DISKETTE).state, [' ']);
		const inside = typeLine(drive(menu.state, [...'weather'.split('')]).state, 'a friend');
		const t = text(inside);
		expect(t).not.toContain('[P]OST');
		expect(t).not.toContain('UPLOAD');
		const view = drive(inside.state, ['2']);
		expect(view.state.screen).toEqual({ id: 'backroom-file', file: 1 });
		expect(text(view)).toContain('THE NIGHT THE DRIVE DIED');
		const back = drive(view.state, ['q']);
		expect(back.state.screen).toEqual({ id: 'backroom' });
		const out = drive(back.state, ['q']);
		expect(out.state.screen).toEqual({ id: 'menu' });
	});

	it('the Back Room is unreachable from any listed menu', () => {
		const menu = drive(connect(RUSTY_DISKETTE).state, [' ']);
		expect(text(menu)).not.toContain('BACK ROOM');
		expect(text(menu)).not.toContain('WEATHER');
	});
});

describe('Grim Corridor (the door game)', () => {
	function atDoor(): StepResult {
		return drive(connect(RUSTY_DISKETTE).state, [' ', 'd']);
	}

	it('[D] opens the intro and the first room', () => {
		const result = atDoor();
		expect(result.state.screen).toEqual({ id: 'door', room: 0 });
		expect(text(result)).toContain('G R I M   C O R R I D O R');
		expect(text(result)).toContain('THE GRATE');
	});

	it('the winning path walks D, T, S and prints the survival screen', () => {
		let result = atDoor();
		result = drive(result.state, ['d']);
		expect(text(result)).toContain('THE LONG DARK');
		result = drive(result.state, ['t']);
		expect(text(result)).toContain('THE LAIR');
		result = drive(result.state, ['s']);
		expect(text(result)).toContain('YOU HAVE SURVIVED');
		// Offline: the win stands but the scorekeeper is out of reach.
		expect(text(result)).toContain('SCOREKEEPER NEEDS A LIVE LINE');
		expect(result.state.screen).toEqual({ id: 'menu' });
	});

	it('walking into the dark or attacking the Grim both die back to the menu', () => {
		const dark = drive(atDoor().state, ['d', 'f']);
		expect(text(dark)).toContain('YOU DIED');
		expect(dark.state.screen).toEqual({ id: 'menu' });

		const brave = drive(atDoor().state, ['d', 't', 'a']);
		expect(text(brave)).toContain('YOU DIED');
		expect(brave.state.screen).toEqual({ id: 'menu' });
	});

	it('[Q] backs out of the corridor at any room', () => {
		const result = drive(atDoor().state, ['d', 'q']);
		expect(result.state.screen).toEqual({ id: 'menu' });
		expect(text(result)).toContain('BACK OUT');
	});

	it('an online win banks the score and prints the hall of legends', () => {
		const menu = login();
		let result = drive(menu, ['d', 'd', 't', 's']);
		expect(result.state.screen).toEqual({ id: 'door-score-wait' });
		expect(result.requests).toEqual([
			{ kind: 'submit-score', score: RUSTY_DISKETTE.door!.winScore }
		]);
		result = deliver(
			result.state,
			{
				kind: 'scores',
				result: 'ok',
				scores: [{ handle: 'PHREAK.99', score: 616, createdAt: 1_784_000_000 }]
			},
			RUSTY_DISKETTE
		);
		expect(text(result)).toContain('HALL OF LEGENDS');
		expect(text(result)).toContain('PHREAK.99');
		expect(result.state.screen).toEqual({ id: 'menu' });
	});
});

describe('[Y]ell for sysop', () => {
	it('yells, waits, and the sysop answers in voice', () => {
		const result = drive(connect(RUSTY_DISKETTE).state, [' ', 'y']);
		expect(result.state.screen).toEqual({ id: 'yell-wait' });
		expect(result.requests).toEqual([{ kind: 'yell' }]);
		const answered = deliver(result.state, { kind: 'yell' }, RUSTY_DISKETTE);
		expect(text(answered)).toContain('-- CV');
		expect(answered.state.screen).toEqual({ id: 'menu' });
	});
});

describe('PROJECT LODESTONE (the payoff)', () => {
	it('answers with a bare LOGIN: prompt — no banner, no name', () => {
		const { state, prints } = connect(LODESTONE, { mode: 'local', sessionHandle: 'WF.CALLER' });
		expect(state.screen).toEqual({ id: 'secret-login' });
		const t = plainText(prints.join('\n'));
		expect(t).toContain('LOGIN:');
		expect(t).not.toContain('LODESTONE');
	});

	it('three bad logins drop carrier (acceptance #6)', () => {
		let state = connect(LODESTONE).state;
		for (const attempt of [1, 2]) {
			state = typeLine(state, 'ADMIN', LODESTONE).state;
			const denied = typeLine(state, 'GUESS', LODESTONE);
			expect(text(denied)).toContain('ACCESS DENIED');
			expect(denied.state.tries).toBe(attempt);
			expect(denied.hangup).toBeUndefined();
			state = denied.state;
		}
		state = typeLine(state, 'ADMIN', LODESTONE).state;
		const dropped = typeLine(state, 'GUESS', LODESTONE);
		expect(dropped.hangup).toBe(true);
		expect(dropped.state.screen).toEqual({ id: 'ended' });
	});

	it('OPERATOR / CROSSTALK opens the console (case-insensitive, like a terminal)', () => {
		let result = typeLine(connect(LODESTONE).state, 'operator', LODESTONE);
		expect(inputKind(result.state)).toBe('masked');
		result = typeLine(result.state, 'crosstalk', LODESTONE);
		expect(result.state.screen).toEqual({ id: 'secret-menu' });
		expect(text(result)).toContain('PROJECT LODESTONE');
		expect(text(result)).toContain('[S]TATUS  [L]OG  [M]AIL  [V]ISITORS');
	});

	it('status, log, and mail render the authored screens', () => {
		const menu = secretMenu();
		expect(text(step(menu, 's', LODESTONE))).toContain('1,462');
		expect(text(step(menu, 'l', LODESTONE))).toContain('SOURCE: INBOUND LINE');
		expect(text(step(menu, 'm', LODESTONE))).toContain('better than anyone I worked with');
	});

	it("visitors lists the three sysops, appends the caller, and registers EVENT 0088 (acceptance #5's last screen)", () => {
		const menu = secretMenu('WF.CALLER');
		const visitors = step(menu, 'v', LODESTONE);
		const t = text(visitors);
		expect(t).toContain('CAPT.VECTOR');
		expect(t).toContain('MAINFRAME.MARY');
		expect(t).toContain('SLAG');
		expect(t).toContain('WF.CALLER');
		expect(t).toContain('87-10-15'); // the caller's own visit date
		expect(t).toContain('EVENT 0088 REGISTERED -- SOURCE: INBOUND LINE (YOU)');
	});

	it('[Q] lets the line go', () => {
		const result = step(secretMenu(), 'q', LODESTONE);
		expect(result.hangup).toBe(true);
		expect(result.state.screen).toEqual({ id: 'ended' });
	});
});

describe('the full chain, offline (acceptance #5 / #16)', () => {
	it('sticky note → 2323 → 8008 → scanlog → 4477 → credential → LODESTONE visitors', () => {
		// 1. The Rusty Diskette: the Grapevine post surfaces Night Circuit.
		const rusty = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '3']);
		const grapevine = typeLine(rusty.state, '1');
		expect(text(grapevine)).toContain('555-8008');

		// 2. Night Circuit: the sweep excerpt (and SCANLOG.TXT) surface 0113.
		const night = drive(connect(NIGHT_CIRCUIT).state, [' ', 'f'], NIGHT_CIRCUIT);
		const scanlog = typeLine(night.state, '1', NIGHT_CIRCUIT);
		expect(text(scanlog)).toContain('5550113');

		// 3. Rusty Diskette's FOUNDRY.TXT (the other entry point) → 4477.
		const files = drive(connect(RUSTY_DISKETTE).state, [' ', 'f']);
		expect(text(typeLine(files.state, '3'))).toContain('555-4477');

		// 4. The Foundry: wf-7's ghost-site story hands over the credential.
		const foundry = drive(connect(FOUNDRY).state, [' ', 'm', '3'], FOUNDRY);
		const oldIron = typeLine(foundry.state, '1', FOUNDRY);
		expect(text(oldIron)).toContain('OPERATOR');
		expect(text(oldIron)).toContain('CROSSTALK');

		// 5. 0113 answers; the credential opens it; the array heard us dial in.
		let lodestone = typeLine(
			connect(LODESTONE, { mode: 'local', sessionHandle: 'CHAINRUNNER', visitDate: '87-10-31' })
				.state,
			'OPERATOR',
			LODESTONE
		);
		lodestone = typeLine(lodestone.state, 'CROSSTALK', LODESTONE);
		const visitors = step(lodestone.state, 'v', LODESTONE);
		expect(text(visitors)).toContain('CHAINRUNNER');
		expect(text(visitors)).toContain('EVENT 0088 REGISTERED');
	});
});

// ── ONLINE (live boards, canned api outcomes) ───────────────────────────────

const LIVE_TOPICS: LiveTopic[] = [
	...canonTopics(RUSTY_DISKETTE).map((t, i) => ({ ...t, id: i + 1 })),
	WALK_TOPIC
];

const LIVE_POSTS: LivePost[] = [
	{
		id: 1,
		author: 'PHREAK.99',
		body: 'first real post {R}no markup{/}',
		createdAt: 1_784_000_000,
		canon: false
	}
];

const LIVE_FILES: LiveFile[] = [
	...canonFiles(RUSTY_DISKETTE),
	{
		id: 'file-77',
		name: 'HELLO.TXT',
		kind: 'txt',
		size: 24,
		uploader: 'PHREAK.99',
		downloads: 2,
		createdAt: 1_784_000_000,
		canon: false
	}
];

function connectOnline(sessionHandle: string | null = null): MachineState {
	return connect(RUSTY_DISKETTE, { mode: 'online', sessionHandle }).state;
}

function login(handle = 'PHREAK.99'): MachineState {
	let result = drive(connectOnline(), [' ']);
	result = typeLine(result.state, handle);
	result = typeLine(result.state, 'hunter2');
	expect(result.requests).toEqual([{ kind: 'login', handle, password: 'hunter2' }]);
	return deliver(result.state, { kind: 'login', result: 'ok', handle }, RUSTY_DISKETTE).state;
}

/** Logged in, boards open, sitting on General Chatter's topic list. */
function atLiveTopics(): MachineState {
	const menu = login();
	const wait = step(menu, 'm', RUSTY_DISKETTE);
	expect(wait.requests).toEqual([{ kind: 'topics' }]);
	const sections = deliver(
		wait.state,
		{ kind: 'topics', result: 'ok', topics: LIVE_TOPICS },
		RUSTY_DISKETTE
	);
	return step(sections.state, '1', RUSTY_DISKETTE).state;
}

/** Logged in, file area open with the live listing stocked. */
function filesOnline(): MachineState {
	const menu = login();
	const wait = step(menu, 'f', RUSTY_DISKETTE);
	expect(wait.state.screen.id).toBe('files-wait');
	expect(wait.requests).toEqual([{ kind: 'files' }]);
	const files = deliver(
		wait.state,
		{ kind: 'files', result: 'ok', files: LIVE_FILES },
		RUSTY_DISKETTE
	);
	expect(files.state.screen.id).toBe('files');
	return files.state;
}

/** Logged into PROJECT LODESTONE, sitting at the console menu. */
function secretMenu(handle = 'WF.CALLER'): MachineState {
	let result = typeLine(
		connect(LODESTONE, { mode: 'local', sessionHandle: handle, visitDate: '87-10-15' }).state,
		'OPERATOR',
		LODESTONE
	);
	result = typeLine(result.state, 'CROSSTALK', LODESTONE);
	expect(result.state.screen).toEqual({ id: 'secret-menu' });
	return result.state;
}

describe('login', () => {
	it('prompts for handle and password, masked, and greets on success', () => {
		let result = drive(connectOnline(), [' ']);
		expect(text(result)).toContain('HANDLE (OR "NEW" TO REGISTER)');
		result = typeLine(result.state, 'phreak.99');
		expect(text(result)).toContain('PASSWORD');
		expect(inputKind(result.state)).toBe('masked');
		result = drive(result.state, ['h', 'i', 'x', 'x']);
		expect(entryEcho(result.state)).toBe('****');
		result = step(result.state, 'Enter', RUSTY_DISKETTE);
		expect(result.state.screen.id).toBe('auth-wait');
		expect(result.requests).toEqual([{ kind: 'login', handle: 'PHREAK.99', password: 'hixx' }]);
		const welcomed = deliver(
			result.state,
			{ kind: 'login', result: 'ok', handle: 'PHREAK.99' },
			RUSTY_DISKETTE
		);
		expect(text(welcomed)).toContain('WELCOME, PHREAK.99');
		expect(welcomed.state.screen).toEqual({ id: 'menu' });
		expect(welcomed.state.handle).toBe('PHREAK.99');
	});

	it('drops carrier after three bad logins', () => {
		let state = drive(connectOnline(), [' ']).state;
		for (const attempt of [1, 2]) {
			state = typeLine(state, 'PHREAK.99').state;
			state = typeLine(state, 'wrong').state;
			const retry = deliver(state, { kind: 'login', result: 'no-carrier' }, RUSTY_DISKETTE);
			expect(text(retry)).toContain(`INVALID LOGIN. (${attempt}/3)`);
			state = retry.state;
		}
		state = typeLine(state, 'PHREAK.99').state;
		state = typeLine(state, 'wrong').state;
		const dropped = deliver(state, { kind: 'login', result: 'no-carrier' }, RUSTY_DISKETTE);
		expect(dropped.hangup).toBe(true);
		expect(text(dropped)).toContain('HANGS UP');
	});

	it('a stored session skips the interrogation and greets by name', () => {
		const result = drive(connectOnline('WF.CALLER'), [' ']);
		expect(text(result)).toContain('WELCOME BACK, WF.CALLER');
		expect(result.state.screen).toEqual({ id: 'menu' });
	});

	it('the menu shows the caller handle', () => {
		const result = drive(connectOnline('WF.CALLER'), [' ']);
		expect(text(result)).toContain('CALLER: WF.CALLER');
	});
});

describe('registration', () => {
	function toQuestionnaire(): StepResult {
		let result = drive(connectOnline(), [' ']);
		result = typeLine(result.state, 'new');
		expect(text(result)).toContain('PICK A HANDLE');
		result = typeLine(result.state, 'fresh.99');
		expect(inputKind(result.state)).toBe('masked');
		result = typeLine(result.state, 'hunter2');
		result = typeLine(result.state, 'hunter2');
		expect(text(result)).toContain(REG_QUESTIONS[0].prompt);
		return result;
	}

	it('walks handle, password twice, and the questionnaire into a register request', () => {
		let result = toQuestionnaire();
		result = typeLine(result.state, 'a sticky note on a lamp post');
		expect(text(result)).toContain(REG_QUESTIONS[1].prompt);
		result = typeLine(result.state, 'C64, 1200 baud');
		expect(result.requests).toEqual([
			{
				kind: 'register',
				handle: 'FRESH.99',
				password: 'hunter2',
				questionnaire: { source: 'a sticky note on a lamp post', rig: 'C64, 1200 baud' }
			}
		]);
		const welcomed = deliver(
			result.state,
			{ kind: 'register', result: 'ok', handle: 'FRESH.99' },
			RUSTY_DISKETTE
		);
		expect(text(welcomed)).toContain('ACCESS GRANTED');
		expect(welcomed.state.handle).toBe('FRESH.99');
	});

	it('rejects malformed handles and mismatched passwords client-side', () => {
		let result = drive(connectOnline(), [' ']);
		result = typeLine(result.state, 'NEW');
		result = typeLine(result.state, 'no spaces here');
		expect(text(result)).toContain("DOESN'T SCAN");
		expect(result.state.screen.id).toBe('reg-handle');
		result = typeLine(result.state, 'FINE');
		result = typeLine(result.state, 'hunter2');
		result = typeLine(result.state, 'hunter3');
		expect(text(result)).toContain("DON'T MATCH");
		expect(result.state.screen.id).toBe('reg-password');
	});

	it('/A backs out of registration at any prompt (no dead ends)', () => {
		let result = drive(connectOnline(), [' ']);
		result = typeLine(result.state, 'NEW');
		result = typeLine(result.state, '/a');
		expect(text(result)).toContain('CHANGED YOUR MIND');
		expect(result.state.screen.id).toBe('login-handle');

		// And from the password prompt, three screens deep.
		result = typeLine(result.state, 'NEW');
		result = typeLine(result.state, 'FRESH.99');
		result = typeLine(result.state, '/a');
		expect(result.state.screen.id).toBe('login-handle');
	});

	it('a taken handle bounces back to the handle prompt with the refusal', () => {
		let result = toQuestionnaire();
		result = typeLine(result.state, 'somewhere');
		result = typeLine(result.state, 'something');
		const refused = deliver(
			result.state,
			{ kind: 'register', result: 'refused', message: 'HANDLE ALREADY IN USE' },
			RUSTY_DISKETTE
		);
		expect(text(refused)).toContain('HANDLE ALREADY IN USE');
		expect(refused.state.screen.id).toBe('reg-handle');
	});
});

describe('live boards', () => {
	it('[M] fetches fresh topics and the sections screen counts them', () => {
		const menu = login();
		const wait = step(menu, 'm', RUSTY_DISKETTE);
		expect(wait.state.screen.id).toBe('sections-wait');
		const sections = deliver(
			wait.state,
			{ kind: 'topics', result: 'ok', topics: LIVE_TOPICS },
			RUSTY_DISKETTE
		);
		expect(sections.state.screen.id).toBe('sections');
		// General Chatter: 3 canon + 1 community topic.
		expect(text(sections)).toContain('General Chatter');
		expect(text(sections)).toContain(' 4 topics');
	});

	it('community topics list beside canon and read through the same path', () => {
		const shown = typeLine(atLiveTopics(), '4'); // the community topic, after 3 canon
		expect(shown.state.screen.id).toBe('read-wait');
		expect(shown.requests).toEqual([{ kind: 'posts', topicId: 101 }]);
		const read = deliver(
			shown.state,
			{ kind: 'posts', result: 'ok', posts: LIVE_POSTS },
			RUSTY_DISKETTE
		);
		expect(read.state.screen).toEqual({ id: 'read', section: 0, topicId: 101, post: 0 });
		// User text is escaped — the markup renders literally instead of coloring.
		expect(text(read)).toContain('first real post {R}no markup{/}');
	});

	it('selects two-digit topic numbers', () => {
		const many: LiveTopic[] = Array.from({ length: 12 }, (_, i) => ({
			...LIVE_TOPICS[0],
			id: i + 1,
			title: `TOPIC ${i + 1}`,
			canon: false,
			pinned: false
		}));
		const menu = login();
		const wait = step(menu, 'm', RUSTY_DISKETTE);
		const sections = deliver(
			wait.state,
			{ kind: 'topics', result: 'ok', topics: many },
			RUSTY_DISKETTE
		);
		const topics = step(sections.state, '1', RUSTY_DISKETTE);
		const picked = typeLine(topics.state, '12');
		expect(picked.requests).toEqual([{ kind: 'posts', topicId: 12 }]);
	});

	it('a vanished thread bounces back to the topic list, in fiction', () => {
		const picked = typeLine(atLiveTopics(), '4');
		const gone = deliver(picked.state, { kind: 'posts', result: 'ok', posts: [] }, RUSTY_DISKETTE);
		expect(gone.state.screen.id).toBe('topics');
		expect(text(gone)).toContain('THE SYSOP CLEANS UP OVERNIGHT');
	});
});

describe('the live file area', () => {
	it('[F] fetches the listing: canon first, community after, ratio note shown', () => {
		const files = filesOnline();
		const listing = plainText(
			deliver(
				{ ...files, screen: { id: 'files-wait' } },
				{ kind: 'files', result: 'ok', files: LIVE_FILES },
				RUSTY_DISKETTE
			).prints.join('\n')
		);
		expect(listing).toContain('MODEM101.TXT');
		expect(listing).toContain('HELLO.TXT');
		expect(listing).toContain('EVERY DOWNLOAD SPENDS A CREDIT');
		expect(listing.indexOf('MODEM101.TXT')).toBeLessThan(listing.indexOf('HELLO.TXT'));
	});

	it('a picked file downloads: request, XMODEM transfer marker, body, prompt', () => {
		const picked = typeLine(filesOnline(), '4');
		expect(picked.state.screen.id).toBe('file-dl-wait');
		expect(picked.requests).toEqual([{ kind: 'download', fileId: 'file-77' }]);
		const done = deliver(
			picked.state,
			{
				kind: 'download',
				result: 'ok',
				file: LIVE_FILES[3],
				body: 'hello from the other side'
			},
			RUSTY_DISKETTE
		);
		expect(done.transfer).toEqual({ name: 'HELLO.TXT', size: 24 });
		expect(text(done)).toContain('hello from the other side');
		expect(done.state.screen.id).toBe('files');
	});

	it('a busted ratio refuses in-fiction and keeps the caller at the listing', () => {
		const picked = typeLine(filesOnline(), '1');
		const refused = deliver(
			picked.state,
			{ kind: 'download', result: 'refused', message: 'RATIO CHECK FAILED. UPLOAD 1 TO UNLOCK 3.' },
			RUSTY_DISKETTE
		);
		expect(text(refused)).toContain('RATIO CHECK FAILED');
		expect(refused.state.screen.id).toBe('files');
	});

	it('an image download announces itself; the window renders the pixels', () => {
		const picked = typeLine(filesOnline(), '4');
		const done = deliver(
			picked.state,
			{
				kind: 'download',
				result: 'ok',
				file: { ...LIVE_FILES[3], name: 'ART.PNG', kind: 'png' },
				body: null
			},
			RUSTY_DISKETTE
		);
		expect(text(done)).toContain('IMAGE RECEIVED');
		expect(done.transfer?.name).toBe('ART.PNG');
	});

	it('uploads a text file: kind, name, line editor, /S — then refreshes', () => {
		let result = typeLine(filesOnline(), 'u');
		expect(result.state.screen.id).toBe('upload-kind');
		result = drive(result.state, ['t']);
		expect(result.state.screen).toEqual({ id: 'upload-name', image: false });
		result = typeLine(result.state, 'field.txt');
		expect(result.state.screen).toMatchObject({ id: 'upload-body', name: 'FIELD.TXT' });
		result = typeLine(result.state, 'notes from the field');
		result = typeLine(result.state, '/s');
		expect(result.state.screen.id).toBe('upload-wait');
		expect(result.requests).toEqual([
			{ kind: 'upload-text', name: 'FIELD.TXT', fileKind: 'txt', body: 'notes from the field' }
		]);
		const done = deliver(result.state, { kind: 'upload', result: 'ok' }, RUSTY_DISKETTE);
		expect(text(done)).toContain('+3 CREDITS');
		expect(done.state.screen.id).toBe('files-wait');
		expect(done.requests).toEqual([{ kind: 'files' }]);
	});

	it('a held upload explains the overnight review (moderation seam down)', () => {
		let result = typeLine(filesOnline(), 'u');
		result = drive(result.state, ['t']);
		result = typeLine(result.state, 'held.txt');
		result = typeLine(result.state, 'borderline content');
		result = typeLine(result.state, '/s');
		const held = deliver(
			result.state,
			{ kind: 'upload', result: 'ok', held: true },
			RUSTY_DISKETTE
		);
		expect(text(held)).toContain('REVIEWS NEW FILES OVERNIGHT');
	});

	it('an image upload hands off to the picker and survives a cancel', () => {
		let result = typeLine(filesOnline(), 'u');
		result = drive(result.state, ['i']);
		expect(result.state.screen).toEqual({ id: 'upload-name', image: true });
		result = typeLine(result.state, 'art1.png');
		expect(result.state.screen.id).toBe('upload-wait');
		expect(result.requests).toEqual([{ kind: 'pick-image', name: 'ART1.PNG' }]);
		const cancelled = deliver(result.state, { kind: 'upload', result: 'aborted' }, RUSTY_DISKETTE);
		expect(text(cancelled)).toContain('NEVER MIND');
		expect(cancelled.state.screen.id).toBe('files');
	});

	it('a malformed upload name re-prompts and /A escapes', () => {
		let result = typeLine(filesOnline(), 'u');
		result = drive(result.state, ['t']);
		result = typeLine(result.state, 'not a dos name at all');
		expect(text(result)).toContain("DOESN'T SCAN");
		expect(result.state.screen).toEqual({ id: 'upload-name', image: false });
		result = typeLine(result.state, '/a');
		expect(result.state.screen.id).toBe('files');
	});
});

describe('who, chat, and the clock', () => {
	it('[W] prints the presence list the socket delivered', () => {
		const menu = login();
		const stocked = deliver(
			menu,
			{ kind: 'presence', online: ['PHREAK.99', 'SLAG.FAN'] },
			RUSTY_DISKETTE
		).state;
		const who = step(stocked, 'w', RUSTY_DISKETTE);
		expect(text(who)).toContain('SLAG.FAN');
		expect(text(who)).toContain('(YOU)');
		expect(who.state.screen).toEqual({ id: 'menu' });
	});

	it('[C] joins the node channel; lines echo back through the node', () => {
		const menu = login();
		const chat = step(menu, 'c', RUSTY_DISKETTE);
		expect(chat.state.screen).toEqual({ id: 'chat' });
		expect(text(chat)).toContain('NODE CHANNEL');
		const sent = typeLine(chat.state, 'anyone got the scanlog?');
		expect(sent.requests).toEqual([{ kind: 'chat-send', text: 'anyone got the scanlog?' }]);
		// Our own line comes back on the broadcast, like everyone else's.
		const echoed = deliver(
			sent.state,
			{ kind: 'chat', handle: 'PHREAK.99', text: 'anyone got the scanlog?' },
			RUSTY_DISKETTE
		);
		expect(text(echoed)).toContain('<PHREAK.99> anyone got the scanlog?');
	});

	it('joins and drops announce themselves in the channel', () => {
		const menu = login();
		const inChat = step(menu, 'c', RUSTY_DISKETTE).state;
		const joined = deliver(
			inChat,
			{ kind: 'presence', online: ['PHREAK.99', 'NEWCOMER'] },
			RUSTY_DISKETTE
		);
		expect(text(joined)).toContain('NEWCOMER JOINS THE NODE');
		const left = deliver(joined.state, { kind: 'presence', online: ['PHREAK.99'] }, RUSTY_DISKETTE);
		expect(text(left)).toContain('NEWCOMER DROPS CARRIER');
	});

	it('/q leaves the channel for the menu', () => {
		const menu = login();
		const chat = step(menu, 'c', RUSTY_DISKETTE);
		const out = typeLine(chat.state, '/q');
		expect(out.state.screen).toEqual({ id: 'menu' });
	});

	it('the menu shows time remaining once the node reports it', () => {
		const menu = login();
		const timed = deliver(menu, { kind: 'time', remaining: 44 }, RUSTY_DISKETTE).state;
		expect(timed.timeRemaining).toBe(44);
		// Any trip back to the menu re-renders it with the clock.
		const yelled = step(timed, 'y', RUSTY_DISKETTE);
		const back = deliver(yelled.state, { kind: 'yell' }, RUSTY_DISKETTE);
		expect(text(back)).toContain('TIME REMAINING TODAY: 44 MIN');
	});

	it('warnings print at 10 and 1 minutes; zero drops carrier (acceptance #12)', () => {
		const menu = login();
		const warned10 = deliver(menu, { kind: 'time', remaining: 10 }, RUSTY_DISKETTE);
		expect(text(warned10)).toContain('10 MINUTES LEFT');
		const warned1 = deliver(warned10.state, { kind: 'time', remaining: 1 }, RUSTY_DISKETTE);
		expect(text(warned1)).toContain('ONE MINUTE LEFT');
		const dropped = deliver(warned1.state, { kind: 'time', remaining: 0 }, RUSTY_DISKETTE);
		expect(text(dropped)).toContain("TIME'S UP");
		expect(dropped.hangup).toBe(true);
	});
});

describe('the composer', () => {
	it('posts a new topic: title, body lines, /S — then refreshes the list', () => {
		let result = drive(atLiveTopics(), ['p']);
		expect(result.state.screen.id).toBe('compose-title');
		result = typeLine(result.state, 'MY FIRST TOPIC');
		expect(result.state.screen.id).toBe('compose-body');
		result = typeLine(result.state, 'hello from 2026');
		result = typeLine(result.state, 'is this thing on');
		result = typeLine(result.state, '/s');
		expect(result.state.screen.id).toBe('post-wait');
		expect(result.requests).toEqual([
			{
				kind: 'submit-topic',
				section: 'general',
				title: 'MY FIRST TOPIC',
				body: 'hello from 2026\nis this thing on'
			}
		]);
		const posted = deliver(result.state, { kind: 'submit', result: 'ok' }, RUSTY_DISKETTE);
		expect(text(posted)).toContain('POSTED');
		expect(posted.state.screen).toEqual({ id: 'topics-refresh', section: 0 });
		expect(posted.requests).toEqual([{ kind: 'topics' }]);
		const refreshed = deliver(
			posted.state,
			{ kind: 'topics', result: 'ok', topics: LIVE_TOPICS },
			RUSTY_DISKETTE
		);
		expect(refreshed.state.screen).toEqual({ id: 'topics', section: 0 });
	});

	it('a held post explains the overnight review instead of celebrating', () => {
		let result = drive(atLiveTopics(), ['p']);
		result = typeLine(result.state, 'HELD TOPIC');
		result = typeLine(result.state, 'the seam was down');
		result = typeLine(result.state, '/s');
		const held = deliver(
			result.state,
			{ kind: 'submit', result: 'ok', held: true },
			RUSTY_DISKETTE
		);
		expect(text(held)).toContain('REVIEWS NEW MESSAGES OVERNIGHT');
	});

	it('replies from a thread and re-reads it after posting', () => {
		const picked = typeLine(atLiveTopics(), '4');
		const read = deliver(
			picked.state,
			{ kind: 'posts', result: 'ok', posts: LIVE_POSTS },
			RUSTY_DISKETTE
		);
		let result = step(read.state, 'r', RUSTY_DISKETTE);
		expect(result.state.screen.id).toBe('compose-body');
		result = typeLine(result.state, 'seconded.');
		result = typeLine(result.state, '/s');
		expect(result.requests).toEqual([{ kind: 'submit-reply', topicId: 101, body: 'seconded.' }]);
		const posted = deliver(result.state, { kind: 'submit', result: 'ok' }, RUSTY_DISKETTE);
		expect(posted.requests).toEqual([{ kind: 'posts', topicId: 101 }]);
	});

	it('a refused post keeps the draft for another /S (the cooldown case)', () => {
		let result = drive(atLiveTopics(), ['p']);
		result = typeLine(result.state, 'TOO FAST');
		result = typeLine(result.state, 'rapid fire');
		result = typeLine(result.state, '/s');
		const refused = deliver(
			result.state,
			{ kind: 'submit', result: 'refused', message: 'ONE POST A MINUTE. THE DRIVE IS OLD.' },
			RUSTY_DISKETTE
		);
		expect(text(refused)).toContain('ONE POST A MINUTE');
		expect(text(refused)).toContain('YOUR DRAFT STANDS');
		expect(refused.state.screen).toMatchObject({ id: 'compose-body', lines: ['rapid fire'] });
		const retry = typeLine(refused.state, '/s');
		expect(retry.requests).toEqual([
			{ kind: 'submit-topic', section: 'general', title: 'TOO FAST', body: 'rapid fire' }
		]);
	});

	it('/A aborts and nothing is sent', () => {
		let result = drive(atLiveTopics(), ['p']);
		result = typeLine(result.state, 'NEVER MIND');
		result = typeLine(result.state, 'draft line');
		result = typeLine(result.state, '/a');
		expect(text(result)).toContain('ABORTED');
		expect(result.state.screen.id).toBe('topics');
		expect(result.requests).toBeUndefined();
	});

	it('an empty body refuses to save', () => {
		let result = drive(atLiveTopics(), ['p']);
		result = typeLine(result.state, 'EMPTY');
		result = typeLine(result.state, '/s');
		expect(text(result)).toContain('NOTHING TO SAVE');
		expect(result.state.screen.id).toBe('compose-body');
	});
});

describe('degradation and session loss (never a dead end)', () => {
	it('a dead trunk mid-call degrades to LOCAL MODE at the menu, canon intact', () => {
		const menu = login();
		const wait = step(menu, 'm', RUSTY_DISKETTE);
		const degraded = deliver(wait.state, { kind: 'topics', result: 'local' }, RUSTY_DISKETTE);
		expect(text(degraded)).toContain('LOCAL MODE');
		expect(degraded.state.mode).toBe('local');
		expect(degraded.state.screen).toEqual({ id: 'menu' });
		// Canon still browses end to end — boards and files.
		const read = typeLine(drive(degraded.state, ['m', '3']).state, '1');
		expect(text(read)).toContain('555-8008');
		expect(degraded.state.files!.every((f) => f.canon)).toBe(true);
	});

	it('a lost post says so and the caller keeps browsing canon', () => {
		let result = drive(atLiveTopics(), ['p']);
		result = typeLine(result.state, 'DOOMED');
		result = typeLine(result.state, 'this will not make it');
		result = typeLine(result.state, '/s');
		const lost = deliver(result.state, { kind: 'submit', result: 'local' }, RUSTY_DISKETTE);
		expect(text(lost)).toContain("YOUR WORDS DIDN'T MAKE IT");
		expect(lost.state.mode).toBe('local');
		expect(lost.state.screen).toEqual({ id: 'menu' });
	});

	it('a dead session mid-call goes back to the login prompt', () => {
		const picked = typeLine(atLiveTopics(), '4');
		const dropped = deliver(picked.state, { kind: 'posts', result: 'no-carrier' }, RUSTY_DISKETTE);
		expect(text(dropped)).toContain('YOUR SESSION DROPPED');
		expect(dropped.state.screen).toEqual({ id: 'login-handle' });
		expect(dropped.state.handle).toBe('GUEST');
	});

	it('a dead trunk during a download degrades without eating the caller', () => {
		const picked = typeLine(filesOnline(), '1');
		const lost = deliver(picked.state, { kind: 'download', result: 'local' }, RUSTY_DISKETTE);
		expect(text(lost)).toContain('TRANSFER DIED');
		expect(lost.state.mode).toBe('local');
		expect(lost.state.screen).toEqual({ id: 'menu' });
	});
});

describe('content hygiene (all canon systems)', () => {
	it('canon lines stay within 80 columns', () => {
		for (const system of CANON_SYSTEMS) {
			const everything = [
				system.banner,
				system.yell ?? '',
				...system.sections.flatMap((s) => s.topics.flatMap((t) => t.posts.map((p) => p.body))),
				...system.files.map((f) => f.body),
				...(system.backRoom ? system.backRoom.files.map((f) => f.body) : []),
				...(system.backRoom ? [system.backRoom.gate, system.backRoom.welcome] : []),
				...(system.door
					? [
							system.door.intro,
							system.door.win,
							system.door.death,
							...system.door.rooms.map((r) => r.body)
						]
					: []),
				...(system.secret ? system.secret.screens.map((s) => s.body) : [])
			];
			for (const block of everything) {
				for (const line of plainText(block).split('\n')) {
					expect(line.length, `${system.id} line too wide: "${line}"`).toBeLessThanOrEqual(80);
				}
			}
		}
	});

	it('ASCII boxes have straight right edges', () => {
		// Every line that ends on a box-border character must end in the same
		// column, or the box goes ragged. (The top border of a classic
		// underscore box ends on `_`, one row above the pipes — it is
		// deliberately outside this check.) Equal character counts only render
		// as equal widths because the terminal disables VT323's fi/fl/ff
		// ligatures — see the .term rule in DialerWindow.
		const blocks = CANON_SYSTEMS.flatMap((system) => [
			system.banner,
			...system.files.map((f) => f.body)
		]);
		for (const block of blocks) {
			for (const border of ['|', '#', ':']) {
				const widths = new Set(
					plainText(block)
						.split('\n')
						.map((line) => line.trimEnd())
						.filter((line) => line.endsWith(border))
						.map((line) => line.length)
				);
				expect(widths.size, `ragged ${border} box edge: widths ${[...widths]}`).toBeLessThanOrEqual(
					1
				);
			}
		}
	});

	it('single-key lists never offer more numbered items than one digit', () => {
		// Sections and back-room files pick by a single key; topics and files
		// take a typed number, so live boards may grow past nine.
		for (const system of CANON_SYSTEMS) {
			expect(system.sections.length, system.id).toBeLessThanOrEqual(9);
			if (system.backRoom) expect(system.backRoom.files.length).toBeLessThanOrEqual(9);
		}
	});

	it('the door rooms all connect to rooms that exist', () => {
		for (const system of CANON_SYSTEMS) {
			if (!system.door) continue;
			for (const room of system.door.rooms) {
				for (const target of Object.values(room.exits)) {
					if (typeof target === 'number') {
						expect(system.door.rooms[target], `${system.id} exit → ${target}`).toBeDefined();
					}
				}
			}
		}
	});
});
