import { describe, it, expect } from 'vitest';
import { connect, step, type MachineState, type Screen } from './bbs-machine';
import { RUSTY_DISKETTE } from './content/rusty-diskette';
import { plainText } from './terminal';

/** All keys the walk tries on every screen. */
const KEYS = ['m', 'f', 'g', 'q', 'n', 'p', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

function screenKey(s: Screen): string {
	return JSON.stringify(s);
}

/**
 * Exhaustively walk the machine: from the connected state, press every key on
 * every discovered screen. Returns every reachable screen plus the edge list.
 */
function walk(system = RUSTY_DISKETTE) {
	const start = connect(system).state;
	const seen = new Map<string, MachineState>([[screenKey(start.screen), start]]);
	const edges = new Map<string, Set<string>>();
	const frontier = [start];
	while (frontier.length > 0) {
		const state = frontier.pop()!;
		const from = screenKey(state.screen);
		if (!edges.has(from)) edges.set(from, new Set());
		for (const key of KEYS) {
			const next = step(state, key, system).state;
			const to = screenKey(next.screen);
			edges.get(from)!.add(to);
			if (!seen.has(to)) {
				seen.set(to, next);
				frontier.push(next);
			}
		}
	}
	return { seen, edges };
}

describe('connect', () => {
	it('prints the banner and the offline GUEST notice, then gates on any key', () => {
		const { state, prints } = connect(RUSTY_DISKETTE);
		expect(state.handle).toBe('GUEST');
		expect(state.screen).toEqual({ id: 'pause' });
		const text = plainText(prints.join('\n'));
		expect(text).toContain('THE RUSTY DISKETTE BBS');
		expect(text).toContain('BROWSING AS GUEST');
		expect(text).toContain('PRESS ANY KEY');
	});
});

describe('reachability (acceptance #3: no dead ends)', () => {
	const { seen, edges } = walk();

	it('reaches every screen type of the slice', () => {
		const ids = new Set([...seen.values()].map((s) => s.screen.id));
		for (const id of ['pause', 'menu', 'sections', 'topics', 'read', 'files', 'file-view', 'ended'])
			expect(ids, `screen ${id}`).toContain(id);
	});

	it('reaches every section, topic, post, and file of the content', () => {
		const screens = [...seen.values()].map((s) => s.screen);
		RUSTY_DISKETTE.sections.forEach((sec, si) => {
			sec.topics.forEach((topic, ti) => {
				topic.posts.forEach((_, pi) => {
					expect(
						screens.some(
							(s) => s.id === 'read' && s.section === si && s.topic === ti && s.post === pi
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

	it('every screen can reach goodbye', () => {
		// Reverse-BFS from 'ended' over the edge list.
		const reversed = new Map<string, Set<string>>();
		for (const [from, tos] of edges) {
			for (const to of tos) {
				if (!reversed.has(to)) reversed.set(to, new Set());
				reversed.get(to)!.add(from);
			}
		}
		const ended = [...seen.keys()].filter((k) => (JSON.parse(k) as Screen).id === 'ended');
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
		for (const key of seen.keys()) expect(canEnd.has(key), `stuck at ${key}`).toBe(true);
	});
});

describe('navigation', () => {
	function drive(keys: string[]): { state: MachineState; text: string } {
		let { state } = connect(RUSTY_DISKETTE);
		let text = '';
		for (const key of keys) {
			const result = step(state, key, RUSTY_DISKETTE);
			state = result.state;
			text = plainText(result.prints.join('\n'));
		}
		return { state, text };
	}

	it('q backs up one level at a time', () => {
		// any-key → menu, M → sections, 1 → topics, 1 → read, then q q q → menu
		const { state } = drive([' ', 'm', '1', '1', 'q', 'q', 'q']);
		expect(state.screen).toEqual({ id: 'menu' });
	});

	it('unlisted keys are ignored', () => {
		const { state: before } = drive([' ']);
		const result = step(before, 'z', RUSTY_DISKETTE);
		expect(result.state).toBe(before);
		expect(result.prints).toEqual([]);
	});

	it('goodbye hangs up', () => {
		let { state } = connect(RUSTY_DISKETTE);
		state = step(state, ' ', RUSTY_DISKETTE).state;
		const result = step(state, 'g', RUSTY_DISKETTE);
		expect(result.hangup).toBe(true);
		expect(result.state.screen).toEqual({ id: 'ended' });
	});

	it('n/p page through a topic and announce the end', () => {
		// General Chatter topic 1 (Halloween) has 3 posts.
		const start = drive([' ', 'm', '1', '1']);
		expect(start.text).toContain('(1/3)');
		let result = step(start.state, 'n', RUSTY_DISKETTE);
		expect(plainText(result.prints.join('\n'))).toContain('(2/3)');
		result = step(result.state, 'n', RUSTY_DISKETTE);
		result = step(result.state, 'n', RUSTY_DISKETTE);
		expect(plainText(result.prints.join('\n'))).toContain('END OF TOPIC');
	});
});

describe('breadcrumbs render on screen (acceptance #4 groundwork)', () => {
	it("the Grapevine phracture post shows Night Circuit's number", () => {
		// menu → [M] → section 3 (Grapevine) → topic 1 → the breadcrumb thread
		let { state } = connect(RUSTY_DISKETTE);
		state = step(state, ' ', RUSTY_DISKETTE).state;
		state = step(state, 'm', RUSTY_DISKETTE).state;
		state = step(state, '3', RUSTY_DISKETTE).state;
		const read = step(state, '1', RUSTY_DISKETTE);
		expect(plainText(read.prints.join('\n'))).toContain('555-8008');
	});

	it("FOUNDRY.TXT shows The Foundry's number", () => {
		let { state } = connect(RUSTY_DISKETTE);
		state = step(state, ' ', RUSTY_DISKETTE).state;
		state = step(state, 'f', RUSTY_DISKETTE).state;
		const view = step(state, '3', RUSTY_DISKETTE);
		const text = plainText(view.prints.join('\n'));
		expect(text).toContain('FOUNDRY.TXT');
		expect(text).toContain('555-4477');
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

	it('menus never offer more numbered items than a single digit', () => {
		expect(RUSTY_DISKETTE.sections.length).toBeLessThanOrEqual(9);
		expect(RUSTY_DISKETTE.files.length).toBeLessThanOrEqual(9);
		for (const sec of RUSTY_DISKETTE.sections) expect(sec.topics.length).toBeLessThanOrEqual(9);
	});
});
