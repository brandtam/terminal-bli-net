import type { CanonSystem, CanonFile } from './content/types';
import { formatEraDate, fileKind } from './content/types';
import { canonDateEpoch } from './content/seed';
import { escapeMarkup, wrapText } from './terminal';
import type { LiveFile, LivePost, LiveScore, LiveTopic } from './api';

/**
 * The BBS session machine: pure `(state, input) → (state, prints, requests)`.
 * It owns everything between CONNECT and NO CARRIER — banners, login and
 * registration, menus, live message boards, the composer, the file area — and
 * knows nothing about sound, timing, fetch, or the DOM.
 *
 * Live boards (slice 2) make some screens data-dependent, so steps can emit
 * `requests`. The window performs each request against api.ts and feeds the
 * outcome back through `deliver()`; tests feed canned responses instead, so
 * every online flow stays walkable without a server. A `local` outcome at any
 * point degrades the session to canon-only content and keeps going — LOCAL
 * MODE may shrink the board, never brick it (ADR 0008).
 *
 * Input model: the window forwards printable keys, Enter, and Backspace. On
 * `keys` screens single letters act immediately (Q backs up one level, no
 * dead ends — PRD acceptance #3, unlisted keys are ignored). On `line`
 * screens the machine buffers `state.entry` itself and Enter submits; the
 * window renders the buffer at the cursor (`entryEcho`), masked for
 * passwords. Enter still binds nothing on `keys` screens, so it stays a safe
 * pure-skip key while text is typing.
 */

export type Mode = 'local' | 'online';

export type Screen =
	| { id: 'pause' } // "PRESS ANY KEY" gate after the banner
	| { id: 'login-handle' }
	| { id: 'login-password'; handle: string }
	| { id: 'reg-handle' }
	| { id: 'reg-password' }
	| { id: 'reg-password2' }
	| { id: 'reg-q'; q: number }
	| { id: 'auth-wait' }
	| { id: 'menu' }
	| { id: 'sections-wait' }
	| { id: 'sections' }
	| { id: 'topics'; section: number }
	| { id: 'read-wait'; section: number; topicId: number }
	| { id: 'read'; section: number; topicId: number; post: number }
	| { id: 'compose-title'; section: number }
	| {
			id: 'compose-body';
			section: number;
			title: string | null; // null = replying
			replyTo: number | null; // topic id when replying
			lines: string[];
	  }
	| { id: 'post-wait'; compose: Extract<Screen, { id: 'compose-body' }> }
	| { id: 'topics-refresh'; section: number } // after posting a new topic
	| { id: 'files' }
	| { id: 'files-wait' }
	| { id: 'file-view'; file: number }
	| { id: 'file-dl-wait' }
	| { id: 'upload-kind' }
	| { id: 'upload-name'; image: boolean }
	| { id: 'upload-body'; name: string; lines: string[] }
	| { id: 'upload-wait' }
	| { id: 'chat' }
	| { id: 'door'; room: number }
	| { id: 'door-score-wait' }
	| { id: 'yell-wait' }
	| { id: 'backroom-gate' }
	| { id: 'backroom' }
	| { id: 'backroom-file'; file: number }
	| { id: 'secret-login' }
	| { id: 'secret-password'; handle: string }
	| { id: 'secret-menu' }
	| { id: 'ended' };

export type MachineState = {
	systemId: string;
	mode: Mode;
	/** GUEST until a login or registration succeeds. */
	handle: string;
	screen: Screen;
	/** The line being typed on `line` screens. The machine owns the buffer. */
	entry: string;
	/** Failed logins this call; the third drops carrier. */
	tries: number;
	reg: { handle: string; password: string; answers: string[] };
	/** Board topics — fetched per visit online, built from canon in local. */
	topics: LiveTopic[] | null;
	/** The open topic's thread. */
	posts: LivePost[] | null;
	/** File-area listing — fetched per visit online, built from canon in local. */
	files: LiveFile[] | null;
	/** Who's connected right now — pushed by the window from the node socket. */
	online: string[];
	/** Minutes left in today's budget, from the node; null until it says. */
	timeRemaining: number | null;
	/** Rolling tail of keys typed at the main menu — the Back Room listens. */
	menuKeys: string;
	/** The caller's date for the LODESTONE visitors log, YY-MM-DD. */
	visitDate: string;
};

/** Work the window performs against api.ts, then feeds back via deliver(). */
export type MachineRequest =
	| { kind: 'login'; handle: string; password: string }
	| { kind: 'register'; handle: string; password: string; questionnaire: Record<string, string> }
	| { kind: 'topics' }
	| { kind: 'posts'; topicId: number }
	| { kind: 'submit-topic'; section: string; title: string; body: string }
	| { kind: 'submit-reply'; topicId: number; body: string }
	| { kind: 'files' }
	| { kind: 'download'; fileId: string }
	| { kind: 'upload-text'; name: string; fileKind: 'txt' | 'md'; body: string }
	/** The window opens a picker, dithers to CGA, uploads, and delivers `upload`. */
	| { kind: 'pick-image'; name: string }
	| { kind: 'submit-score'; score: number }
	| { kind: 'chat-send'; text: string }
	/** The window answers after a believable pause — the sysop was in the garage. */
	| { kind: 'yell' };

export type MachineResponse =
	| { kind: 'login'; result: 'ok' | 'no-carrier' | 'local'; handle?: string }
	| { kind: 'register'; result: 'ok' | 'refused' | 'local'; handle?: string; message?: string }
	| { kind: 'topics'; result: 'ok' | 'no-carrier' | 'local'; topics?: LiveTopic[] }
	| { kind: 'posts'; result: 'ok' | 'no-carrier' | 'local'; posts?: LivePost[] }
	| {
			kind: 'submit';
			result: 'ok' | 'refused' | 'no-carrier' | 'local';
			message?: string;
			/** Moderation seam down: posted but hidden until the nightly re-audit. */
			held?: boolean;
	  }
	| { kind: 'files'; result: 'ok' | 'no-carrier' | 'local'; files?: LiveFile[] }
	| {
			kind: 'download';
			result: 'ok' | 'refused' | 'no-carrier' | 'local';
			file?: LiveFile;
			/** Text body; null for images (the window displays those itself). */
			body?: string | null;
			message?: string;
	  }
	| {
			kind: 'upload';
			result: 'ok' | 'refused' | 'no-carrier' | 'local' | 'aborted';
			message?: string;
			held?: boolean;
	  }
	| { kind: 'scores'; result: 'ok' | 'no-carrier' | 'local'; scores?: LiveScore[] }
	| { kind: 'chat'; handle: string; text: string }
	| { kind: 'presence'; online: string[] }
	| { kind: 'time'; remaining: number }
	| { kind: 'yell' };

export type StepResult = {
	state: MachineState;
	/** Markup lines to type onto the terminal, in order. */
	prints: string[];
	/** True on [G]oodbye or a dropped line — go on-hook. */
	hangup?: boolean;
	/** Async work for the window; outcomes come back through deliver(). */
	requests?: MachineRequest[];
	/** A completed download — the window animates the XMODEM bar before typing. */
	transfer?: { name: string; size: number };
};

const LOCAL_NOTICE = '{R}LOCAL MODE -- LINE NOISE ON THE TRUNK{/}';
/** Offline registration excuse, in-fiction (approved architecture, LOCAL MODE item). */
const GUEST_NOTICE =
	"{R}NEW USER REGISTRATION IS OFFLINE -- SYSOP'S DRIVE IS FULL. BROWSING AS GUEST.{/}";
const MAX_LOGIN_TRIES = 3;
const MAX_ENTRY_CHARS = 78;

/** In-fiction new-user interrogation; answers ride to D1 as the questionnaire. */
export const REG_QUESTIONS = [
	{ key: 'source', prompt: 'WHERE DID YOU GET THIS NUMBER?' },
	{ key: 'rig', prompt: 'WHAT ARE YOU RUNNING? (COMPUTER, MODEM)' }
] as const;

const HANDLE_RE = /^[A-Z0-9.-]{2,16}$/;
const PASSWORD_MIN = 4;
const PASSWORD_MAX = 64;
export const TITLE_MIN = 2;
export const TITLE_MAX = 40;

export type ConnectOptions = {
	mode: Mode;
	/** Handle from a stored session — skips the login interrogation. */
	sessionHandle?: string | null;
	/** Today, YY-MM-DD, for the LODESTONE visitors log. The window passes the real date. */
	visitDate?: string;
};

/** Begin a session right after CONNECT: banner, notices, any-key gate. */
export function connect(system: CanonSystem, opts: ConnectOptions = { mode: 'local' }): StepResult {
	const local = opts.mode === 'local';
	const state: MachineState = {
		systemId: system.id,
		mode: opts.mode,
		handle: local ? 'GUEST' : (opts.sessionHandle ?? 'GUEST'),
		screen: { id: 'pause' },
		entry: '',
		tries: 0,
		reg: { handle: '', password: '', answers: [] },
		topics: local ? canonTopics(system) : null,
		posts: null,
		files: local ? canonFiles(system) : null,
		online: [],
		timeRemaining: null,
		menuKeys: '',
		visitDate: opts.visitDate ?? '87-10-31'
	};

	// A secret system replaces the whole BBS flow: bare carrier, LOGIN:, and
	// nothing else. Entirely static — LOCAL MODE changes nothing here.
	if (system.secret) {
		// A stored board handle rides along for the visitors log, even offline.
		const withHandle = { ...state, handle: opts.sessionHandle ?? state.handle };
		return {
			state: { ...withHandle, screen: { id: 'secret-login' } },
			prints: ['', '{W}LOGIN:{/}']
		};
	}

	const notices = local ? [LOCAL_NOTICE, GUEST_NOTICE] : [];
	return { state, prints: [system.banner, ...notices, '', '{W}[ PRESS ANY KEY ]{/}'] };
}

/** What the window should do with the keyboard right now. */
export function inputKind(state: MachineState): 'keys' | 'line' | 'masked' {
	switch (state.screen.id) {
		case 'login-handle':
		case 'reg-handle':
		case 'reg-q':
		case 'topics':
		case 'compose-title':
		case 'compose-body':
		case 'files':
		case 'upload-name':
		case 'upload-body':
		case 'chat':
		case 'backroom-gate':
		case 'secret-login':
			return 'line';
		case 'login-password':
		case 'reg-password':
		case 'reg-password2':
		case 'secret-password':
			return 'masked';
		default:
			return 'keys';
	}
}

/** The line buffer as the screen shows it (passwords echo asterisks). */
export function entryEcho(state: MachineState): string {
	return inputKind(state) === 'masked' ? '*'.repeat(state.entry.length) : state.entry;
}

/** Advance the session by one key. Pure — same inputs, same outputs. */
export function step(state: MachineState, key: string, system: CanonSystem): StepResult {
	if (inputKind(state) !== 'keys') return lineStep(state, key, system);

	const k = key.toLowerCase();
	const s = state.screen;

	switch (s.id) {
		case 'pause':
			if (key === 'Enter' || key === 'Backspace') return ignore(state); // any *printable* key
			return leaveGate(state, system);

		case 'menu': {
			// The Back Room listens to everything typed at the menu — the code
			// word opens the gate even though it never appears in any listing.
			const listening = withMenuKeys(state, key);
			if (system.backRoom && listening.menuKeys.endsWith(system.backRoom.codeWord.toLowerCase())) {
				return to({ ...listening, menuKeys: '' }, { id: 'backroom-gate' }, [
					'',
					system.backRoom.gate
				]);
			}
			if (k === 'm') return openBoards(listening, system);
			if (k === 'f') return openFiles(listening, system);
			if (k === 'd' && system.door) {
				return to(listening, { id: 'door', room: 0 }, [
					'',
					system.door.intro,
					system.door.rooms[0].body
				]);
			}
			if (k === 'w' && system.live) return { state: listening, prints: renderWho(listening) };
			if (k === 'c' && system.live) {
				if (listening.mode === 'local') {
					return { state: listening, prints: ['{R}CHAT NEEDS A LIVE LINE. (LOCAL MODE){/}'] };
				}
				return to(listening, { id: 'chat' }, renderChatIntro(listening));
			}
			if (k === 'y') {
				return {
					state: { ...listening, screen: { id: 'yell-wait' } },
					prints: ['', '{W}YOU YELL FOR THE SYSOP. SOMEWHERE, A CHAIR CREAKS...{/}'],
					requests: [{ kind: 'yell' }]
				};
			}
			if (k === 'g')
				return {
					state: { ...listening, screen: { id: 'ended' } },
					prints: renderGoodbye(),
					hangup: true
				};
			return { state: listening, prints: [] };
		}

		case 'sections': {
			if (k === 'q') return to(state, { id: 'menu' }, renderMenu(system, state));
			const idx = digit(k, system.sections.length);
			if (idx !== null) return enterSection(state, system, idx);
			return ignore(state);
		}

		case 'read': {
			const posts = state.posts ?? [];
			if (k === 'q')
				return to(
					state,
					{ id: 'topics', section: s.section },
					renderTopics(system, state, s.section)
				);
			if (k === 'n' && s.post < posts.length - 1) {
				const screen: Screen = { ...s, post: s.post + 1 };
				return to(state, screen, renderRead(state, screen));
			}
			if (k === 'n') return { state, prints: ['{W}END OF TOPIC -- [Q] BACK TO TOPICS{/}'] };
			if (k === 'p' && s.post > 0) {
				const screen: Screen = { ...s, post: s.post - 1 };
				return to(state, screen, renderRead(state, screen));
			}
			if (k === 'r' && state.mode === 'online') {
				const screen: Screen = {
					id: 'compose-body',
					section: s.section,
					title: null,
					replyTo: s.topicId,
					lines: []
				};
				return to(state, screen, renderComposeIntro());
			}
			return ignore(state);
		}

		case 'file-view':
			if (k === 'q') return to(state, { id: 'files' }, renderFiles(state));
			return ignore(state);

		case 'upload-kind': {
			if (k === 'q') return to(state, { id: 'files' }, renderFiles(state));
			if (k === 't')
				return to(state, { id: 'upload-name', image: false }, [
					'',
					'{W}FILENAME FOR THE BOARD (8.3 STYLE, .TXT OR .MD):{/}'
				]);
			if (k === 'i')
				return to(state, { id: 'upload-name', image: true }, [
					'',
					'{W}FILENAME FOR THE BOARD (8.3 STYLE, .PNG):{/}',
					'{C}IT WILL BE DITHERED TO 16 COLORS. THAT IS NOT A BUG, THAT IS 1987.{/}'
				]);
			return ignore(state);
		}

		case 'door': {
			const door = system.door;
			if (!door) return to(state, { id: 'menu' }, renderMenu(system, state));
			if (k === 'q') {
				return to(state, { id: 'menu' }, [
					'',
					'{Y}YOU BACK OUT OF THE CORRIDOR. IT DOES NOT FOLLOW. PROBABLY.{/}',
					...renderMenu(system, state)
				]);
			}
			const exit = door.rooms[s.room]?.exits[k.toUpperCase()];
			if (exit === undefined) return ignore(state);
			if (exit === 'die') {
				return to(state, { id: 'menu' }, ['', door.death, ...renderMenu(system, state)]);
			}
			if (exit === 'win') {
				if (state.mode === 'online') {
					return {
						state: { ...state, screen: { id: 'door-score-wait' } },
						prints: ['', door.win, '', '{W}BANKING YOUR RUN WITH THE SCOREKEEPER...{/}'],
						requests: [{ kind: 'submit-score', score: door.winScore }]
					};
				}
				return to(state, { id: 'menu' }, [
					'',
					door.win,
					'',
					'{C}THE SCOREKEEPER NEEDS A LIVE LINE. YOUR LEGEND STAYS LOCAL.{/}',
					...renderMenu(system, state)
				]);
			}
			return to(state, { id: 'door', room: exit }, ['', door.rooms[exit].body]);
		}

		case 'backroom': {
			const room = system.backRoom;
			if (!room || k === 'q') return to(state, { id: 'menu' }, renderMenu(system, state));
			const idx = digit(k, room.files.length);
			if (idx !== null) {
				return to(
					state,
					{ id: 'backroom-file', file: idx },
					renderCanonFileBody(room.files[idx], 'BACK ROOM')
				);
			}
			return ignore(state);
		}

		case 'backroom-file':
			if (k === 'q') return to(state, { id: 'backroom' }, renderBackRoom(system));
			return ignore(state);

		case 'secret-menu': {
			const secret = system.secret;
			if (!secret) return ignore(state);
			if (k === 'q' || k === 'g') {
				return {
					state: { ...state, screen: { id: 'ended' } },
					prints: ['', '{C}THE LINE STAYS OPEN A MOMENT LONGER THAN IT NEEDS TO.{/}'],
					hangup: true
				};
			}
			if (k === 'v') return { state, prints: renderVisitors(state, system) };
			const screen = secret.screens.find((sc) => sc.key.toLowerCase() === k);
			if (!screen || screen.key === 'V') return ignore(state);
			return { state, prints: ['', screen.body, '', renderSecretPrompt(secret)] };
		}

		// Waits sit between a request and its deliver(); keys mean nothing yet.
		case 'auth-wait':
		case 'sections-wait':
		case 'read-wait':
		case 'post-wait':
		case 'topics-refresh':
		case 'files-wait':
		case 'file-dl-wait':
		case 'upload-wait':
		case 'door-score-wait':
		case 'yell-wait':
		case 'ended':
			return ignore(state);

		default:
			return ignore(state);
	}
}

/** Key handling on line screens: the machine owns the entry buffer. */
function lineStep(state: MachineState, key: string, system: CanonSystem): StepResult {
	if (key === 'Backspace') {
		return { state: { ...state, entry: state.entry.slice(0, -1) }, prints: [] };
	}
	if (key !== 'Enter') {
		if (key.length !== 1 || state.entry.length >= MAX_ENTRY_CHARS) return ignore(state);
		// The topic and file prompts take a typed number, but their lettered
		// commands act on the keypress like every single-key screen — [Q]
		// muscle memory must not wait for Enter. A number in progress disables
		// the shortcut.
		const instant =
			state.screen.id === 'topics' ? /^[pq]$/i : state.screen.id === 'files' ? /^[qu]$/i : null;
		if (instant && state.entry === '' && instant.test(key)) {
			return submitLine(state, key.toLowerCase(), system);
		}
		return { state: { ...state, entry: state.entry + key }, prints: [] };
	}

	// Enter — submit the line. Echo it into the scrollback like a real
	// terminal roundtrip, then act.
	const line = state.entry.trim();
	const echo = entryEcho(state);
	const cleared = { ...state, entry: '' };
	const result = submitLine(cleared, line, system);
	return { ...result, prints: [echo, ...result.prints] };
}

/** A completed line of input, routed by screen. */
function submitLine(state: MachineState, line: string, system: CanonSystem): StepResult {
	const s = state.screen;

	switch (s.id) {
		case 'login-handle': {
			if (!line) return ignore(state);
			if (line.toUpperCase() === 'NEW') {
				return to(state, { id: 'reg-handle' }, [
					'',
					'{*W}NEW CALLER.{/} THE SYSOP KEEPS A LIST; LET US GET YOU ON IT.',
					'{C}(/A AT ANY PROMPT BACKS OUT.){/}',
					'',
					'{W}PICK A HANDLE (2-16 CHARS: A-Z 0-9 . -):{/}'
				]);
			}
			return to(state, { id: 'login-password', handle: line.toUpperCase() }, ['{W}PASSWORD:{/}']);
		}

		case 'login-password': {
			if (!line) return ignore(state);
			return {
				state: { ...state, screen: { id: 'auth-wait' } },
				prints: ['', '{W}CHECKING THE LIST...{/}'],
				requests: [{ kind: 'login', handle: s.handle, password: line }]
			};
		}

		case 'reg-handle': {
			if (isRegAbort(line)) return abortRegistration(state);
			const handle = line.toUpperCase();
			if (!HANDLE_RE.test(handle)) {
				return {
					state,
					prints: [
						"{R}THAT HANDLE DOESN'T SCAN. 2-16 CHARS: A-Z 0-9 . -{/}",
						'{W}PICK A HANDLE:{/}'
					]
				};
			}
			return to({ ...state, reg: { ...state.reg, handle } }, { id: 'reg-password' }, [
				`{W}PICK A PASSWORD (${PASSWORD_MIN}-${PASSWORD_MAX} CHARS -- THERE IS NO RECOVERY):{/}`
			]);
		}

		case 'reg-password': {
			if (isRegAbort(line)) return abortRegistration(state);
			if (line.length < PASSWORD_MIN || line.length > PASSWORD_MAX) {
				return {
					state,
					prints: [`{R}${PASSWORD_MIN}-${PASSWORD_MAX} CHARS.{/}`, '{W}PICK A PASSWORD:{/}']
				};
			}
			return to({ ...state, reg: { ...state.reg, password: line } }, { id: 'reg-password2' }, [
				'{W}TYPE IT AGAIN:{/}'
			]);
		}

		case 'reg-password2': {
			if (isRegAbort(line)) return abortRegistration(state);
			if (line !== state.reg.password) {
				return to({ ...state, reg: { ...state.reg, password: '' } }, { id: 'reg-password' }, [
					"{R}THEY DON'T MATCH.{/}",
					'{W}PICK A PASSWORD:{/}'
				]);
			}
			return to({ ...state, reg: { ...state.reg, answers: [] } }, { id: 'reg-q', q: 0 }, [
				'',
				'{*W}NEW USER QUESTIONNAIRE.{/} ANSWER STRAIGHT, THE SYSOP READS THESE.',
				'',
				`{W}${REG_QUESTIONS[0].prompt}{/}`
			]);
		}

		case 'reg-q': {
			if (isRegAbort(line)) return abortRegistration(state);
			if (!line) return ignore(state);
			const answers = [...state.reg.answers, line];
			const nextQ = s.q + 1;
			if (nextQ < REG_QUESTIONS.length) {
				return to({ ...state, reg: { ...state.reg, answers } }, { id: 'reg-q', q: nextQ }, [
					`{W}${REG_QUESTIONS[nextQ].prompt}{/}`
				]);
			}
			const questionnaire = Object.fromEntries(REG_QUESTIONS.map((q, i) => [q.key, answers[i]]));
			return {
				state: { ...state, reg: { ...state.reg, answers }, screen: { id: 'auth-wait' } },
				prints: ['', '{W}THE SYSOP LOOKS YOU OVER...{/}'],
				requests: [
					{
						kind: 'register',
						handle: state.reg.handle,
						password: state.reg.password,
						questionnaire
					}
				]
			};
		}

		case 'topics': {
			if (!line) return ignore(state);
			const command = line.toLowerCase();
			if (command === 'q') return to(state, { id: 'sections' }, renderSections(system, state));
			if (command === 'p') {
				if (state.mode === 'local') {
					return { state, prints: ['{R}POSTING NEEDS A LIVE LINE. (LOCAL MODE){/}'] };
				}
				return to(state, { id: 'compose-title', section: s.section }, [
					'',
					`{W}TOPIC TITLE (${TITLE_MIN}-${TITLE_MAX} CHARS), OR /A TO ABORT:{/}`
				]);
			}
			const list = sectionTopics(state, system, s.section);
			const index = /^\d+$/.test(command) ? Number(command) : NaN;
			if (!Number.isInteger(index) || index < 1 || index > list.length) {
				return { state, prints: ['{R}NO SUCH TOPIC.{/}'] };
			}
			return openTopic(state, system, s.section, list[index - 1].id);
		}

		case 'compose-title': {
			if (line.toLowerCase() === '/a') {
				return to(
					state,
					{ id: 'topics', section: s.section },
					renderTopics(system, state, s.section)
				);
			}
			if (line.length < TITLE_MIN || line.length > TITLE_MAX) {
				return { state, prints: [`{R}${TITLE_MIN}-${TITLE_MAX} CHARS.{/}`, '{W}TOPIC TITLE:{/}'] };
			}
			const screen: Screen = {
				id: 'compose-body',
				section: s.section,
				title: line,
				replyTo: null,
				lines: []
			};
			return to(state, screen, renderComposeIntro());
		}

		case 'compose-body': {
			const command = line.toLowerCase();
			if (command === '/a') {
				return abortCompose(state, system, s);
			}
			if (command === '/s') {
				const body = s.lines.join('\n').trim();
				if (!body) return { state, prints: ['{R}NOTHING TO SAVE.{/}'] };
				const request: MachineRequest =
					s.replyTo === null
						? {
								kind: 'submit-topic',
								section: system.sections[s.section].slug,
								title: s.title ?? '',
								body
							}
						: { kind: 'submit-reply', topicId: s.replyTo, body };
				return {
					state: { ...state, screen: { id: 'post-wait', compose: s } },
					prints: ['{W}SAVING...{/}'],
					requests: [request]
				};
			}
			const screen: Screen = { ...s, lines: [...s.lines, line] };
			return { state: { ...state, screen }, prints: [] };
		}

		case 'files': {
			if (!line) return ignore(state);
			const command = line.toLowerCase();
			if (command === 'q') return to(state, { id: 'menu' }, renderMenu(system, state));
			if (command === 'u') {
				if (state.mode === 'local') {
					return { state, prints: ['{R}UPLOADS NEED A LIVE LINE. (LOCAL MODE){/}'] };
				}
				return to(state, { id: 'upload-kind' }, [
					'',
					'{W}UPLOAD WHAT? {*Y}[T]{/}{W}EXT FILE  {*Y}[I]{/}{W}MAGE  {*Y}[Q]{/}{W} NEVER MIND:{/}'
				]);
			}
			const files = state.files ?? [];
			const index = /^\d+$/.test(command) ? Number(command) : NaN;
			if (!Number.isInteger(index) || index < 1 || index > files.length) {
				return { state, prints: ['{R}NO SUCH FILE.{/}'] };
			}
			return openFile(state, system, index - 1);
		}

		case 'upload-name': {
			if (line.toLowerCase() === '/a') return to(state, { id: 'files' }, renderFiles(state));
			const name = line.toUpperCase();
			const wanted = s.image
				? /^[A-Z0-9][A-Z0-9_-]{0,7}\.PNG$/
				: /^[A-Z0-9][A-Z0-9_-]{0,7}\.(TXT|MD)$/;
			if (!wanted.test(name)) {
				return {
					state,
					prints: [
						`{R}THAT NAME DOESN'T SCAN. 8.3 STYLE, ${s.image ? '.PNG' : '.TXT OR .MD'}.{/}`,
						'{W}FILENAME (OR /A TO ABORT):{/}'
					]
				};
			}
			if (s.image) {
				return {
					state: { ...state, screen: { id: 'upload-wait' } },
					prints: ['{W}PICK YOUR IMAGE...{/}'],
					requests: [{ kind: 'pick-image', name }]
				};
			}
			return to(state, { id: 'upload-body', name, lines: [] }, [
				'',
				'{*W}LINE EDITOR.{/} TYPE THE FILE, ONE LINE AT A TIME.',
				'{W}/S ALONE ON A LINE SAVES. /A ABORTS.{/}',
				''
			]);
		}

		case 'upload-body': {
			const command = line.toLowerCase();
			if (command === '/a') {
				return to(state, { id: 'files' }, [
					'{Y}ABORTED. THE DRIVE THANKS YOU FOR THE SPACE.{/}',
					...renderFiles(state)
				]);
			}
			if (command === '/s') {
				const body = s.lines.join('\n').trim();
				if (!body) return { state, prints: ['{R}NOTHING TO SAVE.{/}'] };
				return {
					state: { ...state, screen: { id: 'upload-wait' } },
					prints: ['{W}SENDING... THE DRIVE GRINDS APPRECIATIVELY.{/}'],
					requests: [
						{
							kind: 'upload-text',
							name: s.name,
							fileKind: s.name.endsWith('.MD') ? 'md' : 'txt',
							body
						}
					]
				};
			}
			const screen: Screen = { ...s, lines: [...s.lines, line] };
			return { state: { ...state, screen }, prints: [] };
		}

		case 'chat': {
			if (!line) return ignore(state);
			if (line.toLowerCase() === '/q') {
				return to(state, { id: 'menu' }, [
					'{C}YOU DROP OUT OF THE NODE CHANNEL.{/}',
					...renderMenu(system, state)
				]);
			}
			// The node echoes the line back to everyone including us; printing
			// happens on the echo so every caller sees the same order.
			return { state, prints: [], requests: [{ kind: 'chat-send', text: line }] };
		}

		case 'backroom-gate': {
			if (!line) return ignore(state);
			const room = system.backRoom;
			if (!room) return to(state, { id: 'menu' }, renderMenu(system, state));
			// Any answer works. The Captain pretends to check the list either way.
			return to(state, { id: 'backroom' }, ['', room.welcome, ...renderBackRoom(system)]);
		}

		case 'secret-login': {
			if (!line) return ignore(state);
			return to(state, { id: 'secret-password', handle: line.toUpperCase() }, ['{W}PASSWORD:{/}']);
		}

		case 'secret-password': {
			const secret = system.secret;
			if (!secret) return ignore(state);
			const good =
				s.handle === secret.loginHandle.toUpperCase() &&
				line.toUpperCase() === secret.loginPassword.toUpperCase();
			if (good) {
				return to({ ...state, tries: 0 }, { id: 'secret-menu' }, renderSecretWelcome(secret));
			}
			const tries = state.tries + 1;
			if (tries >= MAX_LOGIN_TRIES) {
				return {
					state: { ...state, tries, screen: { id: 'ended' } },
					prints: ['', '{R}ACCESS DENIED.{/}'],
					hangup: true
				};
			}
			return to({ ...state, tries }, { id: 'secret-login' }, [
				'',
				'{R}ACCESS DENIED.{/}',
				'',
				'{W}LOGIN:{/}'
			]);
		}

		default:
			return ignore(state);
	}
}

/**
 * Feed an api outcome back into the machine. Every `local` degrades to
 * canon-only and keeps the caller moving; every `no-carrier` on an authed
 * request means the session died — back to the login prompt.
 */
export function deliver(
	state: MachineState,
	response: MachineResponse,
	system: CanonSystem
): StepResult {
	switch (response.kind) {
		case 'login': {
			if (response.result === 'ok') {
				const authed = { ...state, handle: response.handle ?? state.handle, tries: 0 };
				return to(authed, { id: 'menu' }, [
					'',
					`{*G}WELCOME, ${authed.handle}.{/} THE BOARD KNOWS YOUR FACE.`,
					...renderMenu(system, authed)
				]);
			}
			if (response.result === 'local') return degrade(state, system);
			const tries = state.tries + 1;
			if (tries >= MAX_LOGIN_TRIES) {
				return {
					state: { ...state, tries, screen: { id: 'ended' } },
					prints: ['', '{R}INVALID LOGIN. THE BOARD HANGS UP ON YOU.{/}'],
					hangup: true
				};
			}
			return to({ ...state, tries }, { id: 'login-handle' }, [
				'',
				`{R}INVALID LOGIN.{/} (${tries}/${MAX_LOGIN_TRIES})`,
				'',
				'{W}HANDLE (OR "NEW" TO REGISTER):{/}'
			]);
		}

		case 'register': {
			if (response.result === 'ok') {
				const authed = { ...state, handle: response.handle ?? state.reg.handle, tries: 0 };
				return to(authed, { id: 'menu' }, [
					'',
					`{*G}ACCESS GRANTED.{/} WELCOME TO THE BOARD, ${authed.handle}.`,
					'{C}UPLOAD 1, DOWNLOAD 3. THE RATIO IS THE LAW. -- MGMT{/}',
					...renderMenu(system, authed)
				]);
			}
			if (response.result === 'local') return degrade(state, system);
			return to(state, { id: 'reg-handle' }, [
				'',
				`{R}${response.message ?? 'THE SYSOP SHAKES HIS HEAD.'}{/}`,
				'',
				'{W}PICK A HANDLE:{/}'
			]);
		}

		case 'topics': {
			if (response.result === 'local') return degrade(state, system);
			if (response.result === 'no-carrier') return sessionDropped(state);
			const stocked = { ...state, topics: response.topics ?? [] };
			if (state.screen.id === 'topics-refresh') {
				const section = state.screen.section;
				return to(stocked, { id: 'topics', section }, renderTopics(system, stocked, section));
			}
			return to(stocked, { id: 'sections' }, renderSections(system, stocked));
		}

		case 'posts': {
			if (response.result === 'local') return degrade(state, system);
			if (response.result === 'no-carrier') return sessionDropped(state);
			if (state.screen.id !== 'read-wait') return ignore(state);
			const posts = response.posts ?? [];
			if (posts.length === 0) {
				// The thread vanished between listing and reading (moderation).
				return to(state, { id: 'topics', section: state.screen.section }, [
					'{R}THAT THREAD IS GONE. THE SYSOP CLEANS UP OVERNIGHT.{/}'
				]);
			}
			const stocked = { ...state, posts };
			const screen: Screen = {
				id: 'read',
				section: state.screen.section,
				topicId: state.screen.topicId,
				post: 0
			};
			return to(stocked, screen, renderRead(stocked, screen));
		}

		case 'submit': {
			if (state.screen.id !== 'post-wait') return ignore(state);
			const compose = state.screen.compose;
			if (response.result === 'local') {
				return degrade(state, system, ["{R}THE LINE CRACKLES. YOUR WORDS DIDN'T MAKE IT.{/}"]);
			}
			if (response.result === 'no-carrier') return sessionDropped(state);
			if (response.result === 'refused') {
				// Cooldown or validation: the draft survives, try /S again.
				return to(state, compose, [
					`{R}${response.message ?? 'REFUSED.'}{/}`,
					'{W}YOUR DRAFT STANDS. /S TO TRY AGAIN, /A TO ABORT.{/}'
				]);
			}
			const prints = response.held
				? ['{Y}SAVED. THE SYSOP REVIEWS NEW MESSAGES OVERNIGHT.{/}']
				: ['{*G}POSTED. THE BOARD REMEMBERS.{/}'];
			if (compose.replyTo !== null) {
				return {
					state: {
						...state,
						screen: { id: 'read-wait', section: compose.section, topicId: compose.replyTo }
					},
					prints,
					requests: [{ kind: 'posts', topicId: compose.replyTo }]
				};
			}
			return {
				state: { ...state, screen: { id: 'topics-refresh', section: compose.section } },
				prints,
				requests: [{ kind: 'topics' }]
			};
		}

		case 'files': {
			if (response.result === 'local') return degrade(state, system);
			if (response.result === 'no-carrier') return sessionDropped(state);
			const stocked = { ...state, files: response.files ?? [] };
			return to(stocked, { id: 'files' }, renderFiles(stocked));
		}

		case 'download': {
			if (state.screen.id !== 'file-dl-wait') return ignore(state);
			if (response.result === 'local') {
				return degrade(state, system, ['{R}THE TRANSFER DIED WITH THE LINE.{/}']);
			}
			if (response.result === 'no-carrier') return sessionDropped(state);
			if (response.result === 'refused') {
				return to(state, { id: 'files' }, [
					`{R}${response.message ?? 'REFUSED.'}{/}`,
					...renderFiles(state)
				]);
			}
			const file = response.file;
			if (!file) return to(state, { id: 'files' }, renderFiles(state));
			const bodyLines =
				file.kind === 'png'
					? ['{C}[ IMAGE RECEIVED -- RENDERED ON YOUR SCREEN ]{/}']
					: [renderDownloadedBody(file, response.body ?? '')];
			return {
				state: { ...state, screen: { id: 'files' } },
				prints: [
					'',
					`{C}---- ${file.name} -- ${file.size} BYTES -- FROM ${escapeMarkup(file.uploader)} ----{/}`,
					'',
					...bodyLines,
					'',
					filesPrompt(state)
				],
				transfer: { name: file.name, size: file.size }
			};
		}

		case 'upload': {
			if (state.screen.id !== 'upload-wait') return ignore(state);
			if (response.result === 'local') {
				return degrade(state, system, ["{R}THE LINE CRACKLED. THE FILE DIDN'T MAKE IT.{/}"]);
			}
			if (response.result === 'no-carrier') return sessionDropped(state);
			if (response.result === 'aborted') {
				return to(state, { id: 'files' }, ['{Y}NEVER MIND, THEN.{/}', ...renderFiles(state)]);
			}
			if (response.result === 'refused') {
				return to(state, { id: 'files' }, [
					`{R}${response.message ?? 'REFUSED.'}{/}`,
					...renderFiles(state)
				]);
			}
			const prints = response.held
				? ['{Y}RECEIVED. THE SYSOP REVIEWS NEW FILES OVERNIGHT -- CHECK BACK TOMORROW.{/}']
				: ['{*G}RECEIVED. THE RATIO SMILES ON YOU: +3 CREDITS.{/}'];
			// Refresh the listing so the caller sees their file (or doesn't, if held).
			return {
				state: { ...state, screen: { id: 'files-wait' } },
				prints,
				requests: [{ kind: 'files' }]
			};
		}

		case 'scores': {
			if (state.screen.id !== 'door-score-wait') return ignore(state);
			if (response.result === 'local') {
				return degrade(state, system, [
					'{R}THE SCOREKEEPER DROPPED OFF THE LINE. YOUR LEGEND STAYS LOCAL.{/}'
				]);
			}
			if (response.result === 'no-carrier') return sessionDropped(state);
			return to(state, { id: 'menu' }, [
				'',
				...renderScores(system, response.scores ?? []),
				...renderMenu(system, state)
			]);
		}

		case 'chat': {
			if (state.screen.id !== 'chat') return ignore(state);
			return {
				state,
				prints: [`{*C}<${escapeMarkup(response.handle)}>{/} ${escapeMarkup(response.text)}`]
			};
		}

		case 'presence': {
			const previous = state.online;
			const stocked = { ...state, online: response.online };
			if (state.screen.id !== 'chat') return { state: stocked, prints: [] };
			const joined = response.online.filter((h) => !previous.includes(h));
			const left = previous.filter((h) => !response.online.includes(h));
			return {
				state: stocked,
				prints: [
					...joined.map((h) => `{C}-- ${escapeMarkup(h)} JOINS THE NODE --{/}`),
					...left.map((h) => `{C}-- ${escapeMarkup(h)} DROPS CARRIER --{/}`)
				]
			};
		}

		case 'time': {
			const stocked = { ...state, timeRemaining: response.remaining };
			if (response.remaining <= 0) {
				return {
					state: { ...stocked, screen: { id: 'ended' } },
					prints: ['', "{R}TIME'S UP -- CALL BACK TOMORROW.{/}"],
					hangup: true
				};
			}
			if (response.remaining <= 1) {
				return { state: stocked, prints: ['{R}ONE MINUTE LEFT TODAY. SAY YOUR GOODBYES.{/}'] };
			}
			if (response.remaining <= 10) {
				return {
					state: stocked,
					prints: [`{Y}${response.remaining} MINUTES LEFT TODAY. THE CLOCK IS REAL.{/}`]
				};
			}
			return { state: stocked, prints: [] };
		}

		case 'yell': {
			if (state.screen.id !== 'yell-wait') return ignore(state);
			const reply =
				system.yell ?? '{C}THE SYSOP IS NOT ANSWERING. THE BOARD RUNS ITSELF TONIGHT.{/}';
			return to(state, { id: 'menu' }, ['', reply, ...renderMenu(system, state)]);
		}
	}
}

// ── Flow helpers ─────────────────────────────────────────────────────────────

/** Leave the any-key gate: menu (local / returning caller) or the login prompt. */
function leaveGate(state: MachineState, system: CanonSystem): StepResult {
	if (state.mode === 'local') return to(state, { id: 'menu' }, renderMenu(system, state));
	if (state.handle !== 'GUEST') {
		return to(state, { id: 'menu' }, [
			'',
			`{*G}WELCOME BACK, ${state.handle}.{/}`,
			...renderMenu(system, state)
		]);
	}
	return to(state, { id: 'login-handle' }, ['', '{W}HANDLE (OR "NEW" TO REGISTER):{/}']);
}

/** [M] from the menu: canon straight away, live boards fetch fresh first. */
function openBoards(state: MachineState, system: CanonSystem): StepResult {
	if (state.mode === 'local') {
		return to(state, { id: 'sections' }, renderSections(system, state));
	}
	return {
		state: { ...state, screen: { id: 'sections-wait' } },
		prints: ['{W}PULLING THE BOARDS...{/}'],
		requests: [{ kind: 'topics' }]
	};
}

function enterSection(state: MachineState, system: CanonSystem, section: number): StepResult {
	return to(state, { id: 'topics', section }, renderTopics(system, state, section));
}

/** Open a topic: canon threads read from memory, live ones fetch. */
function openTopic(
	state: MachineState,
	system: CanonSystem,
	section: number,
	topicId: number
): StepResult {
	if (state.mode === 'local') {
		const posts = canonPosts(system, topicId);
		const stocked = { ...state, posts };
		const screen: Screen = { id: 'read', section, topicId, post: 0 };
		return to(stocked, screen, renderRead(stocked, screen));
	}
	return {
		state: { ...state, screen: { id: 'read-wait', section, topicId } },
		prints: ['{W}FETCHING...{/}'],
		requests: [{ kind: 'posts', topicId }]
	};
}

function abortCompose(
	state: MachineState,
	system: CanonSystem,
	s: Extract<Screen, { id: 'compose-body' }>
): StepResult {
	const prints = ['{Y}ABORTED. THE BOARD FORGETS DRAFTS.{/}'];
	if (s.replyTo !== null) {
		// Back to the thread as it was.
		const screen: Screen = { id: 'read', section: s.section, topicId: s.replyTo, post: 0 };
		return to(state, screen, [...prints, ...renderRead(state, screen)]);
	}
	return to(state, { id: 'topics', section: s.section }, [
		...prints,
		...renderTopics(system, state, s.section)
	]);
}

/** [F] from the menu: canon straight away, live boards fetch the real listing. */
function openFiles(state: MachineState, system: CanonSystem): StepResult {
	if (state.mode === 'local') {
		const stocked = { ...state, files: canonFiles(system) };
		return to(stocked, { id: 'files' }, renderFiles(stocked));
	}
	return {
		state: { ...state, screen: { id: 'files-wait' } },
		prints: ['{W}READING THE DRIVE...{/}'],
		requests: [{ kind: 'files' }]
	};
}

/** A file by listing index: local reads the canon body, online downloads (1 credit). */
function openFile(state: MachineState, system: CanonSystem, index: number): StepResult {
	const file = (state.files ?? [])[index];
	if (!file) return { state, prints: ['{R}NO SUCH FILE.{/}'] };
	if (state.mode === 'local') {
		const canon = system.files.find((f) => f.name === file.name);
		if (!canon) return { state, prints: ['{R}NO SUCH FILE.{/}'] };
		return to(state, { id: 'file-view', file: index }, renderCanonFileBody(canon, 'FILE AREA'));
	}
	return {
		state: { ...state, screen: { id: 'file-dl-wait' } },
		prints: [`{W}REQUESTING ${file.name}...{/}`],
		requests: [{ kind: 'download', fileId: file.id }]
	};
}

/**
 * The trunk went quiet mid-call: swap to canon content, keep the session
 * moving at the main menu. Never a dead end.
 */
function degrade(state: MachineState, system: CanonSystem, extra: string[] = []): StepResult {
	const local: MachineState = {
		...state,
		mode: 'local',
		topics: canonTopics(system),
		posts: null,
		files: canonFiles(system)
	};
	return to(local, { id: 'menu' }, ['', ...extra, LOCAL_NOTICE, ...renderMenu(system, local)]);
}

function isRegAbort(line: string): boolean {
	return line.toLowerCase() === '/a';
}

/** /A anywhere in registration backs out to the login prompt — no dead ends. */
function abortRegistration(state: MachineState): StepResult {
	return to({ ...state, reg: { handle: '', password: '', answers: [] } }, { id: 'login-handle' }, [
		'',
		'{Y}CHANGED YOUR MIND. THE LIST SURVIVES WITHOUT YOU.{/}',
		'',
		'{W}HANDLE (OR "NEW" TO REGISTER):{/}'
	]);
}

/** An authed request answered 401: the session is dead, log in again. */
function sessionDropped(state: MachineState): StepResult {
	return to({ ...state, handle: 'GUEST', tries: 0 }, { id: 'login-handle' }, [
		'',
		'{R}LINE RE-SYNC -- YOUR SESSION DROPPED. LOG IN AGAIN.{/}',
		'',
		'{W}HANDLE (OR "NEW" TO REGISTER):{/}'
	]);
}

// ── Canon → live view (one render path for both modes) ──────────────────────

/**
 * Canon topics as LiveTopic rows, ids synthesized negative so they can never
 * collide with D1 ids. Used in LOCAL MODE; online the same rows come back
 * from the server, seeded by the content migrations.
 */
export function canonTopics(system: CanonSystem): LiveTopic[] {
	return system.sections.flatMap((section, si) =>
		section.topics.map((topic, ti) => {
			const posts = topic.posts;
			return {
				id: -(si * 100 + ti + 1),
				slug: topic.slug,
				section: section.slug,
				title: topic.title,
				author: posts[0].author,
				createdAt: canonDateEpoch(posts[0].date),
				postCount: posts.length,
				lastPostAt: canonDateEpoch(posts[posts.length - 1].date),
				canon: true,
				pinned: true
			};
		})
	);
}

/** The canon thread behind a synthetic topic id (see canonTopics). */
export function canonPosts(system: CanonSystem, topicId: number): LivePost[] {
	const index = -topicId - 1;
	const si = Math.floor(index / 100);
	const ti = index % 100;
	const topic = system.sections[si]?.topics[ti];
	if (!topic) return [];
	return topic.posts.map((post, pi) => ({
		id: -(pi + 1),
		author: post.author,
		body: post.body,
		createdAt: canonDateEpoch(post.date),
		canon: true
	}));
}

function sectionTopics(state: MachineState, system: CanonSystem, section: number): LiveTopic[] {
	const slug = system.sections[section].slug;
	return (state.topics ?? []).filter((t) => t.section === slug);
}

/**
 * Canon files as LiveFile rows for LOCAL MODE — same deterministic ids the
 * seed migration uses, so read-tracking and rendering never fork by mode.
 */
export function canonFiles(system: CanonSystem): LiveFile[] {
	return system.files.map((file) => ({
		id: `canon:${system.id}:${file.name}`,
		name: file.name,
		kind: fileKind(file),
		size: byteLength(file.body),
		uploader: file.uploader,
		downloads: file.downloads,
		createdAt: canonDateEpoch(file.date),
		canon: true
	}));
}

function byteLength(text: string): number {
	return new TextEncoder().encode(text).length;
}

// ── Screen renderers ─────────────────────────────────────────────────────────

function renderMenu(system: CanonSystem, state: MachineState): string[] {
	const status =
		state.mode === 'online' && state.timeRemaining !== null
			? [`{C}TIME REMAINING TODAY: ${state.timeRemaining} MIN{/}`]
			: [];
	return [
		'',
		`{*W}${system.name.toUpperCase()}{/}  --  MAIN MENU`,
		`{C}CALLER: ${state.handle}{/}`,
		...status,
		'',
		'  {*Y}[M]{/}essage boards',
		'  {*Y}[F]{/}ile area',
		...(system.door ? [`  {*Y}[D]{/}oor game -- ${system.door.name}`] : []),
		...(system.live ? ["  {*Y}[W]{/}ho's online", '  {*Y}[C]{/}hat'] : []),
		'  {*Y}[Y]{/}ell for sysop',
		'  {*Y}[G]{/}oodbye (hang up)',
		'',
		'{W}COMMAND:{/}'
	];
}

function renderSections(system: CanonSystem, state: MachineState): string[] {
	const lines = ['', '{*W}MESSAGE BOARDS{/}', ''];
	system.sections.forEach((sec, i) => {
		const count = sectionTopics(state, system, i).length;
		lines.push(`  {*Y}[${i + 1}]{/} ${sec.title.padEnd(28)} ${String(count).padStart(2)} topics`);
	});
	lines.push('', '{W}BOARD # OR [Q] FOR MAIN MENU:{/}');
	return lines;
}

function renderTopics(system: CanonSystem, state: MachineState, section: number): string[] {
	const sec = system.sections[section];
	const topics = sectionTopics(state, system, section);
	const lines = ['', `{*W}${sec.title.toUpperCase()}{/}`, ''];
	topics.forEach((t, i) => {
		const num = `[${i + 1}]`.padStart(4);
		const title = escapeMarkup(t.title).slice(0, 34);
		lines.push(
			`{*Y}${num}{/} ${title.padEnd(34)} ${String(t.postCount).padStart(3)} msgs  ${formatEraDate(t.lastPostAt)}`
		);
	});
	if (topics.length === 0) lines.push('  {C}NOTHING POSTED YET. BE FIRST.{/}');
	const post = state.mode === 'online' ? '  [P]OST' : '';
	lines.push('', `{W}TOPIC #${post}  OR [Q] TO BACK UP:{/}`);
	return lines;
}

function renderRead(state: MachineState, s: Extract<Screen, { id: 'read' }>): string[] {
	const posts = state.posts ?? [];
	const post = posts[s.post];
	if (!post) return ['{R}NOTHING HERE.{/}'];
	const topic = (state.topics ?? []).find((t) => t.id === s.topicId);
	const title = topic ? escapeMarkup(topic.title) : '';
	const reply = state.mode === 'online' ? '[R]eply  ' : '';
	return [
		'',
		`{C}--------------------------------------------------------------------------{/}`,
		`{*W}${title}{/}  (${s.post + 1}/${posts.length})`,
		`{C}FROM: ${escapeMarkup(post.author).padEnd(20)} DATE: ${formatEraDate(post.createdAt)}{/}`,
		`{C}--------------------------------------------------------------------------{/}`,
		renderBody(post),
		'',
		`{W}[N]ext  [P]revious  ${reply}[Q] BACK TO TOPICS:{/}`
	];
}

/** Canon bodies color themselves; caller text is escaped and hard-wrapped. */
function renderBody(post: LivePost): string {
	if (post.canon) return post.body;
	return wrapText(escapeMarkup(post.body), 78).join('\n');
}

function renderComposeIntro(): string[] {
	return [
		'',
		'{*W}LINE EDITOR.{/} TYPE YOUR MESSAGE, ONE LINE AT A TIME.',
		'{W}/S ALONE ON A LINE SAVES. /A ABORTS.{/}',
		''
	];
}

function renderFiles(state: MachineState): string[] {
	const files = state.files ?? [];
	const lines = ['', '{*W}FILE AREA{/}', '', '      NAME          SIZE  UPLOADER          DLS'];
	files.forEach((f, i) => {
		const num = `[${i + 1}]`.padStart(4);
		lines.push(
			`{*Y}${num}{/} ${escapeMarkup(f.name).padEnd(12)} ${String(f.size).padStart(5)}  ${escapeMarkup(f.uploader).padEnd(16)} ${String(f.downloads).padStart(4)}`
		);
	});
	if (files.length === 0) lines.push('  {C}THE DRIVE IS EMPTY. HISTORY AWAITS.{/}');
	if (state.mode === 'online') {
		lines.push('', '{C}EVERY DOWNLOAD SPENDS A CREDIT. UPLOAD 1, EARN 3.{/}');
	}
	lines.push('', filesPrompt(state));
	return lines;
}

function filesPrompt(state: MachineState): string {
	const upload = state.mode === 'online' ? '  [U]PLOAD' : '';
	return `{W}FILE # TO READ${upload}  OR [Q] FOR MAIN MENU:{/}`;
}

/** A canon file body, viewed free of charge (LOCAL MODE and the Back Room). */
function renderCanonFileBody(file: CanonFile, backTo: string): string[] {
	return [
		'',
		`{C}---- ${file.name} -- uploaded by ${file.uploader}, ${file.date} ----{/}`,
		'',
		file.body,
		'',
		`{W}[Q] BACK TO ${backTo}:{/}`
	];
}

/** A downloaded body: canon colors itself, community text is escaped + wrapped. */
function renderDownloadedBody(file: LiveFile, body: string): string {
	if (file.canon) return body;
	return wrapText(escapeMarkup(body), 78).join('\n');
}

function renderWho(state: MachineState): string[] {
	if (state.mode === 'local') {
		return [
			'',
			"{*W}WHO'S ONLINE{/}",
			'',
			'{C}NO NODE LINE IN LOCAL MODE. JUST YOU AND THE MOON.{/}'
		];
	}
	const lines = ['', "{*W}WHO'S ONLINE{/}", ''];
	if (state.online.length === 0) {
		lines.push('{C}JUST YOU ON THE LINE. IT HAPPENS.{/}');
	} else {
		state.online.forEach((h) => {
			const you = h === state.handle ? '  {C}(YOU){/}' : '';
			lines.push(`  {*C}${escapeMarkup(h)}{/}${you}`);
		});
	}
	return lines;
}

function renderChatIntro(state: MachineState): string[] {
	return [
		'',
		'{*W}NODE CHANNEL{/} -- LINES GO TO EVERYONE ON THE BOARD. /Q LEAVES.',
		state.online.length > 1
			? `{C}ON THE NODE: ${state.online.map((h) => escapeMarkup(h)).join(', ')}{/}`
			: '{C}NOBODY ELSE ON THE NODE. TALK TO THE ROOM ANYWAY.{/}',
		''
	];
}

function renderBackRoom(system: CanonSystem): string[] {
	const room = system.backRoom;
	if (!room) return [];
	const lines = ['', '{*W}THE BACK ROOM{/}', ''];
	room.files.forEach((f, i) => {
		lines.push(`  {*Y}[${i + 1}]{/} ${f.name.padEnd(12)}  ${f.uploader.padEnd(14)} ${f.date}`);
	});
	lines.push('', '{W}FILE # TO READ OR [Q] TO SLIP BACK OUT:{/}');
	return lines;
}

function renderScores(system: CanonSystem, scores: LiveScore[]): string[] {
	const name = system.door?.name ?? 'DOOR GAME';
	const lines = ['', `{*W}${name} -- HALL OF LEGENDS{/}`, ''];
	if (scores.length === 0) {
		lines.push('{C}THE TABLE IS EMPTY. YOU MAY BE THE FIRST.{/}');
	} else {
		scores.forEach((s, i) => {
			lines.push(
				`  ${String(i + 1).padStart(2)}. ${escapeMarkup(s.handle).padEnd(18)} ${String(s.score).padStart(6)}  ${formatEraDate(s.createdAt)}`
			);
		});
	}
	return lines;
}

function renderSecretWelcome(secret: NonNullable<CanonSystem['secret']>): string[] {
	return [
		'',
		'{G}CONNECTED.{/}',
		'',
		'{*W}PROJECT LODESTONE{/} -- REMOTE OPERATOR CONSOLE',
		'',
		renderSecretPrompt(secret)
	];
}

function renderSecretPrompt(secret: NonNullable<CanonSystem['secret']>): string {
	const items = secret.screens.map((sc) => `[${sc.key}]${sc.label.slice(1).toUpperCase()}`);
	return `{W}${items.join('  ')}  [Q]UIT:{/}`;
}

function renderVisitors(state: MachineState, system: CanonSystem): string[] {
	const secret = system.secret;
	if (!secret) return [];
	const header = secret.screens.find((sc) => sc.key === 'V')?.body ?? 'VISITORS.LOG';
	const caller = `${state.handle.padEnd(14)} ${state.visitDate}`;
	return [
		'',
		header,
		'',
		...secret.visitorsSeed.map((line) => `  ${line}`),
		`  ${escapeMarkup(caller)}`,
		'',
		`{*W}${secret.eventLine}{/}`,
		'',
		renderSecretPrompt(secret)
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

/** Append a printable key to the menu's rolling code-word buffer. */
function withMenuKeys(state: MachineState, key: string): MachineState {
	if (key.length !== 1) return state;
	return { ...state, menuKeys: (state.menuKeys + key.toLowerCase()).slice(-12) };
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
