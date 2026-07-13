import { describe, it, expect } from 'vitest';
import {
	canonTopics,
	connect,
	deliver,
	entryEcho,
	inputKind,
	step,
	REG_QUESTIONS,
	type MachineState,
	type StepResult
} from './bbs-machine';
import type { LivePost, LiveTopic } from './api';
import { RUSTY_DISKETTE } from './content/rusty-diskette';
import { plainText } from './terminal';

/** All keys the walk tries on every screen. */
const KEYS = ['m', 'f', 'g', 'q', 'n', 'p', 'r', 's', '1', '2', '3', '9', 'Enter', 'Backspace'];

/**
 * Line-input screens make the state space (screen × entry) — the walk keys on
 * both, and prunes entries longer than two characters: every canon list fits
 * in two digits, so longer buffers reach nothing new.
 */
function stateKey(s: MachineState): string {
	return JSON.stringify({ screen: s.screen, entry: s.entry });
}

/**
 * Exhaustively walk the machine in LOCAL MODE: from the connected state,
 * press every key on every discovered (screen, entry) node. Returns the
 * expanded node set plus the edge list. Local mode has no request screens, so
 * the walk never stalls on a wait state.
 */
function walk(system = RUSTY_DISKETTE) {
	const start = connect(system).state;
	const seen = new Map<string, MachineState>([[stateKey(start), start]]);
	const expanded = new Set<string>();
	const edges = new Map<string, Set<string>>();
	const frontier = [start];
	while (frontier.length > 0) {
		const state = frontier.pop()!;
		const from = stateKey(state);
		if (expanded.has(from) || state.entry.length > 2) continue;
		expanded.add(from);
		if (!edges.has(from)) edges.set(from, new Set());
		for (const key of KEYS) {
			const next = step(state, key, system).state;
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

function drive(state: MachineState, keys: string[], system = RUSTY_DISKETTE): StepResult {
	let result: StepResult = { state, prints: [] };
	for (const key of keys) {
		result = step(result.state, key, system);
	}
	return result;
}

/** Type a whole line and press Enter, like a caller would. */
function typeLine(state: MachineState, text: string, system = RUSTY_DISKETTE): StepResult {
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
});

describe('reachability (acceptance #3: no dead ends, local walk)', () => {
	const { seen, expanded, edges } = walk();

	it('reaches every local screen type of the slice', () => {
		const ids = new Set([...seen.values()].map((s) => s.screen.id));
		for (const id of ['pause', 'menu', 'sections', 'topics', 'read', 'files', 'file-view', 'ended'])
			expect(ids, `screen ${id}`).toContain(id);
	});

	it('reaches every section, topic, post, and file of the content', () => {
		const screens = [...seen.values()].map((s) => s.screen);
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
	});

	it('every expanded state can reach goodbye', () => {
		// Reverse-BFS from 'ended' over the edge list.
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
		const { state } = drive(connect(RUSTY_DISKETTE).state, [' ']);
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
});

describe('breadcrumbs render on screen (acceptance #4 groundwork)', () => {
	it("the Grapevine phracture post shows Night Circuit's number", () => {
		const topics = drive(connect(RUSTY_DISKETTE).state, [' ', 'm', '3']);
		const read = typeLine(topics.state, '1');
		expect(text(read)).toContain('555-8008');
	});

	it("FOUNDRY.TXT shows The Foundry's number", () => {
		const result = drive(connect(RUSTY_DISKETTE).state, [' ', 'f', '3']);
		const t = text(result);
		expect(t).toContain('FOUNDRY.TXT');
		expect(t).toContain('555-4477');
	});
});

// ── ONLINE (live boards, canned api outcomes) ───────────────────────────────

const LIVE_TOPICS: LiveTopic[] = [
	...canonTopics(RUSTY_DISKETTE).map((t, i) => ({ ...t, id: i + 1 })),
	{
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
	}
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
		// Canon still browses end to end.
		const read = typeLine(drive(degraded.state, ['m', '3']).state, '1');
		expect(text(read)).toContain('555-8008');
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
});

describe('content hygiene', () => {
	it('canon lines stay within 80 columns', () => {
		const everything = [
			RUSTY_DISKETTE.banner,
			...RUSTY_DISKETTE.sections.flatMap((s) =>
				s.topics.flatMap((t) => t.posts.map((p) => p.body))
			),
			...RUSTY_DISKETTE.files.map((f) => f.body)
		];
		for (const block of everything) {
			for (const line of plainText(block).split('\n')) {
				expect(line.length, `line too wide: "${line}"`).toBeLessThanOrEqual(80);
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
		const blocks = [RUSTY_DISKETTE.banner, ...RUSTY_DISKETTE.files.map((f) => f.body)];
		for (const block of blocks) {
			for (const border of ['|', '#']) {
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

	it('single-key menus never offer more numbered items than one digit', () => {
		// Sections and files pick by a single key; topics take a typed number,
		// so live boards may grow past nine.
		expect(RUSTY_DISKETTE.sections.length).toBeLessThanOrEqual(9);
		expect(RUSTY_DISKETTE.files.length).toBeLessThanOrEqual(9);
	});
});
