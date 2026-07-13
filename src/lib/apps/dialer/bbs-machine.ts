import type { CanonSystem } from './content/types';

/**
 * The BBS session machine: pure `(state, key) → (state, prints)`. It owns
 * everything between CONNECT and NO CARRIER — banners, menus, message
 * sections, the file area — and knows nothing about sound, timing, or the
 * DOM, so tests can walk every screen of every system exhaustively.
 *
 * Navigation contract (PRD acceptance #3): single-key commands, listed on
 * every screen; Q backs up one level; no dead ends — every screen reaches
 * [G]oodbye. Unlisted keys are ignored.
 *
 * Slice 1 scope: offline canon browsing as GUEST. Login, posting, files
 * up/down, chat, and doors arrive in later slices as new screens here.
 */

export type Screen =
	| { id: 'pause' } // "PRESS ANY KEY" gate after the banner
	| { id: 'menu' }
	| { id: 'sections' }
	| { id: 'topics'; section: number }
	| { id: 'read'; section: number; topic: number; post: number }
	| { id: 'files' }
	| { id: 'file-view'; file: number }
	| { id: 'ended' };

export type MachineState = {
	systemId: string;
	handle: string;
	screen: Screen;
};

export type StepResult = {
	state: MachineState;
	/** Markup lines to type onto the terminal, in order. */
	prints: string[];
	/** True on [G]oodbye — the caller should drop carrier and go on-hook. */
	hangup?: boolean;
};

/** Offline notice, in-fiction (approved architecture, LOCAL MODE item). */
const GUEST_NOTICE =
	"{R}NEW USER REGISTRATION IS OFFLINE -- SYSOP'S DRIVE IS FULL. BROWSING AS GUEST.{/}";

/** Begin a session right after CONNECT: banner, login area, any-key gate. */
export function connect(system: CanonSystem, handle = 'GUEST'): StepResult {
	return {
		state: { systemId: system.id, handle, screen: { id: 'pause' } },
		prints: [system.banner, GUEST_NOTICE, '', '{W}[ PRESS ANY KEY ]{/}']
	};
}

/** Advance the session by one key. Pure — same inputs, same outputs. */
export function step(state: MachineState, key: string, system: CanonSystem): StepResult {
	const k = key.toLowerCase();
	const s = state.screen;

	switch (s.id) {
		case 'pause':
			return to(state, { id: 'menu' }, renderMenu(system));

		case 'menu':
			if (k === 'm') return to(state, { id: 'sections' }, renderSections(system));
			if (k === 'f') return to(state, { id: 'files' }, renderFiles(system));
			if (k === 'g')
				return {
					state: { ...state, screen: { id: 'ended' } },
					prints: renderGoodbye(),
					hangup: true
				};
			return ignore(state);

		case 'sections': {
			if (k === 'q') return to(state, { id: 'menu' }, renderMenu(system));
			const idx = digit(k, system.sections.length);
			if (idx !== null) return to(state, { id: 'topics', section: idx }, renderTopics(system, idx));
			return ignore(state);
		}

		case 'topics': {
			if (k === 'q') return to(state, { id: 'sections' }, renderSections(system));
			const idx = digit(k, system.sections[s.section].topics.length);
			if (idx !== null) {
				const screen: Screen = { id: 'read', section: s.section, topic: idx, post: 0 };
				return to(state, screen, renderRead(system, screen));
			}
			return ignore(state);
		}

		case 'read': {
			const topic = system.sections[s.section].topics[s.topic];
			if (k === 'q')
				return to(state, { id: 'topics', section: s.section }, renderTopics(system, s.section));
			if (k === 'n' && s.post < topic.posts.length - 1) {
				const screen: Screen = { ...s, post: s.post + 1 };
				return to(state, screen, renderRead(system, screen));
			}
			if (k === 'n') return { state, prints: ['{W}END OF TOPIC -- [Q] BACK TO TOPICS{/}'] };
			if (k === 'p' && s.post > 0) {
				const screen: Screen = { ...s, post: s.post - 1 };
				return to(state, screen, renderRead(system, screen));
			}
			return ignore(state);
		}

		case 'files': {
			if (k === 'q') return to(state, { id: 'menu' }, renderMenu(system));
			const idx = digit(k, system.files.length);
			if (idx !== null)
				return to(state, { id: 'file-view', file: idx }, renderFileView(system, idx));
			return ignore(state);
		}

		case 'file-view':
			if (k === 'q') return to(state, { id: 'files' }, renderFiles(system));
			return ignore(state);

		case 'ended':
			return ignore(state);
	}
}

// ── Screen renderers ─────────────────────────────────────────────────────────

function renderMenu(system: CanonSystem): string[] {
	return [
		'',
		`{*W}${system.name.toUpperCase()}{/}  --  MAIN MENU`,
		'',
		'  {*Y}[M]{/}essage boards',
		'  {*Y}[F]{/}ile area',
		'  {*Y}[G]{/}oodbye (hang up)',
		'',
		'{W}COMMAND:{/}'
	];
}

function renderSections(system: CanonSystem): string[] {
	const lines = ['', '{*W}MESSAGE BOARDS{/}', ''];
	system.sections.forEach((sec, i) => {
		const topics = String(sec.topics.length).padStart(2);
		lines.push(`  {*Y}[${i + 1}]{/} ${sec.title.padEnd(28)} ${topics} topics`);
	});
	lines.push('', '{W}BOARD # OR [Q] FOR MAIN MENU:{/}');
	return lines;
}

function renderTopics(system: CanonSystem, section: number): string[] {
	const sec = system.sections[section];
	const lines = ['', `{*W}${sec.title.toUpperCase()}{/}`, ''];
	sec.topics.forEach((t, i) => {
		const last = t.posts[t.posts.length - 1];
		lines.push(
			`  {*Y}[${i + 1}]{/} ${t.title.padEnd(34)} ${String(t.posts.length).padStart(2)} msgs  ${last.date}`
		);
	});
	lines.push('', '{W}TOPIC # OR [Q] TO BACK UP:{/}');
	return lines;
}

function renderRead(system: CanonSystem, s: Extract<Screen, { id: 'read' }>): string[] {
	const topic = system.sections[s.section].topics[s.topic];
	const post = topic.posts[s.post];
	return [
		'',
		`{C}--------------------------------------------------------------------------{/}`,
		`{*W}${topic.title}{/}  (${s.post + 1}/${topic.posts.length})`,
		`{C}FROM: ${post.author.padEnd(20)} DATE: ${post.date}{/}`,
		`{C}--------------------------------------------------------------------------{/}`,
		post.body,
		'',
		'{W}[N]ext  [P]revious  [Q] BACK TO TOPICS:{/}'
	];
}

function renderFiles(system: CanonSystem): string[] {
	const lines = ['', '{*W}FILE AREA{/}', '', '      NAME          SIZE  UPLOADER        DLS'];
	system.files.forEach((f, i) => {
		const size = String(f.body.length).padStart(5);
		lines.push(
			`  {*Y}[${i + 1}]{/} ${f.name.padEnd(12)} ${size}  ${f.uploader.padEnd(14)} ${String(f.downloads).padStart(4)}`
		);
	});
	lines.push('', '{W}FILE # TO VIEW OR [Q] FOR MAIN MENU:{/}');
	return lines;
}

function renderFileView(system: CanonSystem, file: number): string[] {
	const f = system.files[file];
	return [
		'',
		`{C}---- ${f.name} -- uploaded by ${f.uploader}, ${f.date} ----{/}`,
		'',
		f.body,
		'',
		'{W}[Q] BACK TO FILE AREA:{/}'
	];
}

function renderGoodbye(): string[] {
	return [
		'',
		'{*W}THANKS FOR CALLING. THE BOARD REMEMBERS.{/}',
		'',
		'{Y}Carrier dropping in 3... 2... 1...{/}'
	];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function to(state: MachineState, screen: Screen, prints: string[]): StepResult {
	return { state: { ...state, screen }, prints };
}

function ignore(state: MachineState): StepResult {
	return { state, prints: [] };
}

/** Parse a 1-based digit key into a 0-based index, or null if out of range. */
function digit(k: string, max: number): number | null {
	if (!/^[1-9]$/.test(k)) return null;
	const idx = Number(k) - 1;
	return idx < max ? idx : null;
}
