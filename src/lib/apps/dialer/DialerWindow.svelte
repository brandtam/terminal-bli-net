<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { getAppContext } from '$lib/os/os-context';
	import type { AudioLine } from '$lib/os/audio.svelte';
	import { ModemSynth, HANDSHAKE } from './sounds';
	import { TerminalBuffer } from './terminal-buffer.svelte';
	import { charsPerSecond, BAUD_RATES, type BaudRate } from './terminal';
	import { systemByNumber, systemById } from './content';
	import type { CanonSystem } from './content/types';
	import { formatNumber, trainsAt } from './content/types';
	import {
		connect,
		deliver,
		entryEcho,
		inputKind,
		step,
		type MachineRequest,
		type MachineResponse,
		type MachineState,
		type Mode,
		type StepResult
	} from './bbs-machine';
	import * as api from './api';
	import type { LiveFile, Session } from './api';
	import {
		GUARD_MS,
		commandKey,
		guardElapsed,
		hayesOnline,
		watchKey,
		type HayesResult
	} from './hayes';
	import {
		freshProgress,
		loadProgress,
		saveProgress,
		sightNumber,
		verifySystem,
		type DialerProgress,
		type FoundNumber
	} from './persistence';
	import { connectNode, type NodeConnection } from './chat';
	import {
		blockLabel,
		blockPrefixes,
		scanlogLines,
		sweepBlock,
		type SweepResult
	} from './autodialer';
	import { ditherImageToPng } from './dither';
	import { dialerBus } from './bus';
	import { PHOSPHOR_COLORS, loadPrefs, prefs, setBaud } from './prefs.svelte';

	const { os, fs, storage, lifecycle, turnstileSiteKey } = getAppContext();
	loadPrefs(storage);

	type View = 'dial' | 'call' | 'phonebook' | 'sweep';
	type CallPhase = 'connecting' | 'session' | 'busy' | 'no-answer' | 'dropped';

	let view = $state<View>('dial');
	let phase = $state<CallPhase>('connecting');
	let number = $state('');
	/** Baud + phosphor come from the shared prefs store (live-updated by the dialog). */
	const baud = $derived<BaudRate>(prefs.baud);
	const phosphor = $derived(PHOSPHOR_COLORS[prefs.phosphor]);
	/** The line being typed on input screens, mirrored from the machine. */
	let inputEcho = $state('');
	/** Progress (phonebook, scanlogs, verified systems) — drives the dial-screen UI. */
	let progress = $state<DialerProgress>(freshProgress());
	/** The selected 100-block on the sweep screen. */
	let sweepPrefix = $state(blockPrefixes()[0]);
	/** Live sweep output, printed line by line as the montage plays. */
	let sweepLines = $state<string[]>([]);
	let sweepRunning = $state(false);
	const term = new TerminalBuffer();
	/** Hidden file input for image uploads (the dither picker). */
	let imagePicker: HTMLInputElement | null = null;

	// Session state lives outside $state on purpose: only key handlers read it,
	// and every step replaces it wholesale.
	let machine: MachineState | null = null;
	/** Bearer session for /api/dialer/*; persisted in AppData progress.json. */
	let session: Session | null = null;
	/** Bumped on every dial/hang-up so stale async work knows to stand down. */
	let callSeq = 0;
	/** The Hayes layer under the session: +++ escape and AT command mode. */
	let hayes = hayesOnline();
	/** Pending guard-time check after a +++; any key cancels it. */
	let guardTimer = 0;
	/** The trunk probe racing the handshake audio (fired at DIAL). */
	let lineCheck: Promise<LineCheck> | null = null;
	/** The live board node socket (presence, chat, time), open only during a call. */
	let node: NodeConnection | null = null;
	/** Resolves the image the picker returns, or null on cancel. */
	let imagePick: ((blob: Blob | null) => void) | null = null;
	/** A just-downloaded image, shown as a CRT overlay until dismissed. */
	let lastImage = $state<Blob | null>(null);
	const lastImageUrl = $derived(lastImage ? URL.createObjectURL(lastImage) : null);
	$effect(() => {
		const url = lastImageUrl;
		return () => {
			if (url) URL.revokeObjectURL(url);
		};
	});

	type LineCheck = { mode: Mode; session: Session | null };

	let line: AudioLine | null = null;
	let synth: ModemSynth | null = null;
	let dialToneOn = false;
	let timeouts: number[] = [];

	const KEYPAD = [
		['1', ''],
		['2', 'ABC'],
		['3', 'DEF'],
		['4', 'GHI'],
		['5', 'JKL'],
		['6', 'MNO'],
		['7', 'PRS'],
		['8', 'TUV'],
		['9', 'WXY'],
		['*', ''],
		['0', 'OPER'],
		['#', '']
	] as const;

	/** The one path to the synth — called from gesture handlers only, so the
	 * OS audio line (which needs a user gesture) is always available. */
	function ensureSynth(): ModemSynth | null {
		if (!synth) {
			line = os.audio.line();
			if (line) synth = new ModemSynth(line);
		}
		return synth;
	}

	function ensureDialTone(): void {
		const s = ensureSynth();
		if (s && !dialToneOn && view === 'dial') {
			s.startDialTone();
			dialToneOn = true;
		}
	}

	function schedule(fn: () => void, ms: number): void {
		timeouts.push(window.setTimeout(fn, ms));
	}

	function clearScheduled(): void {
		for (const id of timeouts) clearTimeout(id);
		timeouts = [];
	}

	const handlers = {
		hangUp: () => {
			if (view === 'call' && phase !== 'dropped') altHangup();
		},
		showPhonebook: () => {
			if (view === 'dial') view = 'phonebook';
		},
		startSweep: () => {
			if (view === 'dial') view = 'sweep';
		},
		inCall: () => view === 'call' && phase === 'session'
	};
	dialerBus.register(handlers);

	// Load stored progress once so the dial screen shows the phonebook and the
	// caller's found numbers straight away.
	void loadProgress(fs).then((loaded) => {
		progress = loaded;
	});

	lifecycle.onCleanup(() => {
		clearScheduled();
		window.clearTimeout(guardTimer);
		node?.close();
		synth?.stopAll();
		line?.close();
		dialerBus.clear(handlers);
	});

	// ── Dial screen ─────────────────────────────────────────────────────────

	function pressDigit(d: string): void {
		ensureDialTone();
		synth?.playDigit(d);
		if (/[0-9]/.test(d) && number.length < 7) number += d;
	}

	function backspace(): void {
		number = number.slice(0, -1);
	}

	function chooseBaud(b: BaudRate): void {
		setBaud(storage, b);
	}

	function dial(): void {
		if (number.length !== 7) return;
		const s = ensureSynth();
		s?.stopAll();
		dialToneOn = false;
		clearScheduled();
		window.clearTimeout(guardTimer);
		callSeq++;
		view = 'call';
		phase = 'connecting';
		machine = null;
		hayes = hayesOnline();
		inputEcho = '';
		term.clear();
		term.print(`{W}ATDT ${formatNumber(number)}{/}`);
		term.print('{W}DIALING...{/}');

		const system = systemByNumber(number);
		// Probe the trunk while the modems scream at each other — by CONNECT we
		// know whether this call is live or LOCAL MODE (ADR 0008 degradation).
		lineCheck = system ? checkLine(system) : null;
		// Boards have one phone line; occasionally it's busy (PRD). Real
		// occupancy replaces the dice once the live line lands.
		const busyLine = system !== null && Math.random() < 0.07;

		schedule(() => {
			if (system && !busyLine) {
				const ringS = synth?.playRingback() ?? 0;
				term.print('{W}RINGING...{/}');
				schedule(() => beginHandshake(), ringS * 1000);
			} else if (busyLine) {
				const busyS = synth?.playBusy(4) ?? 0;
				term.print('{R}BUSY{/}');
				schedule(() => {
					phase = 'busy';
					term.print('');
					term.print('{W}[R]EDIAL  [Q] HANG UP{/}');
				}, busyS * 1000);
			} else {
				// An unknown number: one of three canned outcomes, chosen by the
				// digits so a given number always answers the same way (PRD #15).
				cannedNoConnect(number);
			}
		}, 400);
	}

	/** The three in-fiction dead ends for a number no board answers. */
	function cannedNoConnect(digits: string): void {
		let hash = 0;
		for (const ch of digits) hash = (hash * 31 + ch.charCodeAt(0)) & 0xffff;
		const kind = hash % 3;
		if (kind === 0) {
			// Endless ring.
			const ringS = synth?.playRingback() ?? 0;
			term.print('{W}RINGING...{/}');
			schedule(() => {
				const againS = synth?.playRingback() ?? 0;
				schedule(() => {
					phase = 'no-answer';
					term.print('{R}NO ANSWER -- IT JUST RINGS.{/}');
					term.print('');
					term.print('{W}[Q] HANG UP{/}');
				}, againS * 1000);
			}, ringS * 1000);
		} else if (kind === 1) {
			const busyS = synth?.playBusy(4) ?? 0;
			term.print('{R}BUSY{/}');
			schedule(() => {
				phase = 'no-answer';
				term.print('');
				term.print('{W}[Q] HANG UP{/}');
			}, busyS * 1000);
		} else {
			// The in-fiction voice gag — a person, not a modem.
			const ringS = synth?.playRingback() ?? 0;
			term.print('{W}RINGING...{/}');
			schedule(() => {
				phase = 'no-answer';
				term.print(`{Y}"...hello? HELLO? Kevin, is this you? Quit calling this{/}`);
				term.print(`{Y} number." *click*{/}`);
				term.print('');
				term.print('{W}[Q] HANG UP{/}');
			}, ringS * 1000);
		}
	}

	// ── Phonebook + Autodialer ───────────────────────────────────────────────

	/** Dial a number straight from the phonebook. */
	function dialNumber(digits: string): void {
		number = digits;
		view = 'dial';
		dial();
	}

	/**
	 * Run tonight's exchange sweep of the selected 100-block. The server's
	 * `sweep` route decides whether a block is allowed today (one a night); if
	 * it refuses, the client honors the refusal in-fiction. LOCAL MODE falls
	 * back to the client's own check — we let the sweep run offline but only
	 * once (the scanlog for today already existing is the guard).
	 */
	async function runSweep(): Promise<void> {
		if (sweepRunning) return;
		sweepRunning = true;
		sweepLines = [];
		const token = session?.token;

		if (token) {
			const claim = await api.claimSweep(token);
			if (!claim.ok && claim.error.kind === 'refused') {
				sweepLines = [claim.error.message];
				sweepRunning = false;
				return;
			}
		} else if (progress.scanlogs.some((log) => log.date === today())) {
			sweepLines = ['ONE SWEEP A NIGHT. THE PHONE COMPANY NOTICES.'];
			sweepRunning = false;
			return;
		}

		const result = sweepBlock(sweepPrefix);
		const s = ensureSynth();
		// Print the montage line by line at a compressed cadence (~1.5s/number
		// would be endless for 100; step in small batches with a quick tone).
		for (let i = 0; i < result.calls.length; i++) {
			const call = result.calls[i];
			s?.playDigit(call.number[6]);
			sweepLines = [...sweepLines, formatSweepLine(call.number, call.outcome, call.systemId)];
			await settleAfter(20, null);
		}
		await bankSweep(result);
		sweepRunning = false;
	}

	function formatSweepLine(digits: string, outcome: string, systemId: string | null): string {
		const tag = systemId ? 'CARRIER -- NAMED BOARD' : outcome;
		return `${formatNumber(digits)} ... ${tag}`;
	}

	/** Persist the scan: carriers enter the phonebook, the log is kept. */
	async function bankSweep(result: SweepResult): Promise<void> {
		let next: DialerProgress = {
			...progress,
			scanlogs: [
				...progress.scanlogs,
				{ block: result.block, date: today(), lines: scanlogLines(result) }
			]
		};
		for (const carrier of result.carriers) {
			next = sightNumber(next, carrier, 'an exchange sweep');
		}
		await persist(next);
	}

	function beginHandshake(): void {
		term.print('{W}CARRIER DETECTED{/}');
		term.print('{W}NEGOTIATING...{/}');
		synth?.playHandshake();
		// A capped far end answers with carrier but never syncs above its rate
		// (LODESTONE trains at 300 only). The screech runs its course, then the
		// line drops — the caller's cue to come back at a lower baud.
		const system = systemByNumber(number);
		if (system && !trainsAt(system, baud)) {
			schedule(() => {
				synth?.stopAll();
				term.print(`{R}CARRIER WON'T TRAIN AT ${baud}{/}`);
				dropCarrier();
			}, HANDSHAKE.connectAtS * 1000);
			return;
		}
		schedule(() => term.print(`{*G}CONNECT ${baud}{/}`), HANDSHAKE.connectAtS * 1000);
		schedule(() => void startSession(), HANDSHAKE.totalS * 1000);
	}

	/**
	 * The handshake finished: settle the trunk probe (a slow answer past the
	 * grace window counts as line noise — LOCAL MODE, never a hang) and log
	 * the caller in.
	 */
	async function startSession(): Promise<void> {
		const system = systemByNumber(number);
		if (!system) return;
		const seq = callSeq;
		const check = await Promise.race([
			lineCheck ?? Promise.resolve({ mode: 'local' as const, session: null }),
			settleAfter(3000, { mode: 'local' as const, session: null })
		]);
		if (seq !== callSeq || view !== 'call') return; // caller hung up while we waited
		session = check.session;
		phase = 'session';
		// Dialing in verifies the system: it graduates found → verified, and its
		// number leaves the ?UNVERIFIED? list.
		await persist(verifySystem(progress, system.id));
		// Live public boards get a node socket for presence, chat, and the clock.
		if (check.mode === 'online' && check.session && system.live) {
			openNode(system.id, check.session.token, seq);
		}
		applyResult(
			connect(system, {
				mode: check.mode,
				sessionHandle: check.session?.handle ?? null,
				visitDate: today()
			}),
			system
		);
	}

	/** YY-MM-DD for the LODESTONE visitors log — the caller's real date, in period form. */
	function today(): string {
		const now = new Date();
		const yy = String(now.getFullYear() % 100).padStart(2, '0');
		const mm = String(now.getMonth() + 1).padStart(2, '0');
		const dd = String(now.getDate()).padStart(2, '0');
		return `${yy}-${mm}-${dd}`;
	}

	/** Open the board node socket; its events feed the machine via deliver(). */
	function openNode(board: string, token: string, seq: number): void {
		node?.close();
		node = connectNode(
			board,
			token,
			(event) => {
				if (seq !== callSeq || !machine) return;
				const system = systemById(machine.systemId);
				if (!system) return;
				// The node events map one-to-one onto machine responses (type → kind).
				const response: MachineResponse =
					event.type === 'chat'
						? { kind: 'chat', handle: event.handle, text: event.text }
						: event.type === 'presence'
							? { kind: 'presence', online: event.online }
							: { kind: 'time', remaining: event.remaining };
				applyResult(deliver(machine, response, system), system);
			},
			() => {
				// A dropped node is just a quiet node — presence stops updating.
				if (seq === callSeq) node = null;
			}
		);
	}

	/** Persist progress and mirror it into the reactive copy for the dial UI. */
	async function persist(next: DialerProgress): Promise<void> {
		progress = next;
		await saveProgress(fs, next);
	}

	/**
	 * Any 555-XXXX the terminal just rendered — canon or a real caller's post —
	 * enters the phonebook as ?UNVERIFIED? (PRD acceptance #4). Runs over the
	 * prints of every machine step.
	 */
	function sightNumbers(prints: string[], source: string): void {
		let next = progress;
		for (const digits of numbersIn(prints.join('\n'))) {
			next = sightNumber(next, digits, source);
		}
		if (next !== progress) void persist(next);
	}

	/** Extract seven-digit 555 numbers from rendered text, normalized to digits. */
	function numbersIn(text: string): string[] {
		const found: string[] = [];
		// 555-XXXX (with or without the dash) and bare 555XXXX both count; the
		// scanlog prints the bare form, posts print the dashed one.
		for (const match of text.matchAll(/\b555[-\s]?\d{4}\b/g)) {
			const digits = match[0].replace(/[-\s]/g, '');
			if (!found.includes(digits)) found.push(digits);
		}
		return found;
	}

	/** Load stored progress and probe the trunk; expired sessions are shed here. */
	async function checkLine(system: CanonSystem): Promise<LineCheck> {
		const loaded = await loadProgress(fs);
		progress = loaded;
		const stored = loaded.session;
		const status = await api.probeLine(system.id, stored?.token);
		if (status === 'local') return { mode: 'local', session: stored };
		if (status === 'login') {
			if (stored) await persist({ ...loaded, session: null });
			return { mode: 'online', session: null };
		}
		return { mode: 'online', session: stored };
	}

	function settleAfter<T>(ms: number, value: T): Promise<T> {
		return new Promise((resolve) => window.setTimeout(() => resolve(value), ms));
	}

	function hangupToDial(): void {
		clearScheduled();
		window.clearTimeout(guardTimer);
		callSeq++;
		node?.close();
		node = null;
		synth?.stopAll();
		machine = null;
		hayes = hayesOnline();
		inputEcho = '';
		lastImage = null;
		term.clear();
		view = 'dial';
		phase = 'connecting';
		ensureDialTone();
	}

	/** Drop the line: carrier drop, NO CARRIER, back to the dial screen. */
	function dropCarrier(): void {
		window.clearTimeout(guardTimer);
		node?.close();
		node = null;
		phase = 'dropped';
		inputEcho = '';
		schedule(() => {
			synth?.playCarrierDrop();
			term.print('{R}NO CARRIER{/}');
		}, 1500);
		schedule(() => hangupToDial(), 3000);
	}

	/** ALT-H, the ProComm/Telix hangup key: drop the line from any call
	 * phase. The window owns it — no wait screen or stalled request can
	 * take it away from the caller. */
	function altHangup(): void {
		if (view !== 'call' || phase === 'dropped') return;
		clearScheduled();
		if (phase === 'session') {
			term.print('');
			term.print('{W}+++ATH{/}');
			hayes = hayesOnline();
			inputEcho = '';
			dropCarrier();
		} else {
			// No carrier yet (dialing, busy, no answer) — just put the
			// handset down.
			hangupToDial();
		}
	}

	// ── Session keys and the api request loop ───────────────────────────────

	function sessionKey(key: string): void {
		if (!machine) return;
		const system = systemById(machine.systemId);
		if (!system) return;
		applyResult(step(machine, key, system), system);
	}

	/** The one funnel for machine output: state, prints, echo, hangup, requests. */
	function applyResult(result: StepResult, system: CanonSystem): void {
		machine = result.state;
		term.printLines(result.prints);
		// Any number the board just showed us — canon or a real caller's post —
		// enters the phonebook (PRD acceptance #4).
		sightNumbers(result.prints, system.name);
		// While the modem holds the line (+++ escape), the command entry owns
		// the cursor — an async deliver() must not put the session echo back.
		if (hayes.mode !== 'command') inputEcho = entryEcho(result.state);
		if (result.transfer) void animateTransfer(result.transfer);
		if (result.hangup) {
			dropCarrier();
			return;
		}
		if (result.requests?.length) void runRequests(result.requests, system);
	}

	/** The XMODEM progress bar: a block gauge filling at baud speed, then done. */
	async function animateTransfer(transfer: { name: string; size: number }): Promise<void> {
		const seq = callSeq;
		const blocks = Math.max(1, Math.ceil(transfer.size / 128)); // 128-byte XMODEM blocks
		const width = 24;
		term.commit(`{C}XMODEM ${transfer.name} [${'.'.repeat(width)}] 0/${blocks}{/}`);
		for (let done = 1; done <= blocks; done++) {
			const filled = Math.round((done / blocks) * width);
			const bar = '#'.repeat(filled) + '.'.repeat(width - filled);
			term.replaceLast(`{C}XMODEM ${transfer.name} [${bar}] ${done}/${blocks}{/}`);
			await settleAfter(Math.min(40, 800 / blocks), null);
			if (seq !== callSeq) return;
		}
	}

	/** The one funnel for modem-layer output: state, prints, echo, actions. */
	function applyHayes(result: HayesResult): void {
		hayes = result.state;
		term.printLines(result.prints);
		if (result.action === 'hangup') {
			dropCarrier();
			return;
		}
		if (result.action === 'resume') term.print(`{*G}CONNECT ${baud}{/}`);
		inputEcho = hayes.mode === 'command' ? hayes.entry : machine ? entryEcho(machine) : '';
	}

	/** Perform machine requests in order, feeding outcomes back to deliver(). */
	async function runRequests(requests: MachineRequest[], system: CanonSystem): Promise<void> {
		const seq = callSeq;
		for (const request of requests) {
			const response = await perform(request, system);
			if (seq !== callSeq || !machine) return; // the call ended while we waited
			applyResult(deliver(machine, response, system), system);
		}
	}

	async function perform(request: MachineRequest, system: CanonSystem): Promise<MachineResponse> {
		const board = system.id;
		const token = session?.token ?? '';
		switch (request.kind) {
			case 'login': {
				const result = await api.login(request.handle, request.password);
				if (result.ok) {
					await keepSession(result.value);
					return { kind: 'login', result: 'ok', handle: result.value.handle };
				}
				return {
					kind: 'login',
					result: result.error.kind === 'local' ? 'local' : 'no-carrier'
				};
			}
			case 'register': {
				const result = await api.register(
					request.handle,
					request.password,
					request.questionnaire,
					turnstileSiteKey
				);
				if (result.ok) {
					await keepSession(result.value);
					return { kind: 'register', result: 'ok', handle: result.value.handle };
				}
				if (result.error.kind === 'local') return { kind: 'register', result: 'local' };
				const message =
					result.error.kind === 'refused' ? result.error.message : 'THE LINE GARBLED THAT.';
				return { kind: 'register', result: 'refused', message };
			}
			case 'topics': {
				const result = await api.fetchTopics(board, token);
				if (result.ok) return { kind: 'topics', result: 'ok', topics: result.value };
				return { kind: 'topics', result: await authedFailure(result.error) };
			}
			case 'posts': {
				const result = await api.fetchPosts(board, request.topicId, token);
				if (result.ok) return { kind: 'posts', result: 'ok', posts: result.value };
				return { kind: 'posts', result: await authedFailure(result.error) };
			}
			case 'submit-topic': {
				const result = await api.submitTopic(board, token, {
					section: request.section,
					title: request.title,
					body: request.body
				});
				return submitOutcome(result);
			}
			case 'submit-reply': {
				const result = await api.submitReply(board, request.topicId, token, request.body);
				return submitOutcome(result);
			}
			case 'files': {
				const result = await api.fetchFiles(board, token);
				if (result.ok) return { kind: 'files', result: 'ok', files: result.value };
				return { kind: 'files', result: await authedFailure(result.error) };
			}
			case 'download': {
				const result = await api.downloadFile(request.fileId, token);
				if (result.ok) {
					// The image body never reaches the machine; the window renders it.
					if (result.value.imageBlob) lastImage = result.value.imageBlob;
					return {
						kind: 'download',
						result: 'ok',
						file: result.value.file,
						body: result.value.body
					};
				}
				if (result.error.kind === 'refused')
					return { kind: 'download', result: 'refused', message: result.error.message };
				return { kind: 'download', result: await authedFailure(result.error) };
			}
			case 'upload-text': {
				const result = await api.uploadTextFile(board, token, {
					name: request.name,
					kind: request.fileKind,
					body: request.body
				});
				return uploadOutcome(result);
			}
			case 'pick-image': {
				const blob = await pickImage();
				if (!blob) return { kind: 'upload', result: 'aborted' };
				let dataBase64: string;
				try {
					dataBase64 = await ditherImageToPng(blob);
				} catch {
					return { kind: 'upload', result: 'refused', message: "THAT IMAGE WON'T DITHER DOWN." };
				}
				const result = await api.uploadImageFile(board, token, { name: request.name, dataBase64 });
				return uploadOutcome(result);
			}
			case 'submit-score': {
				const result = await api.submitScore(board, token, request.score);
				if (result.ok) {
					await bankScore(request.score);
					return { kind: 'scores', result: 'ok', scores: result.value };
				}
				if (result.error.kind === 'no-carrier') {
					await dropSession();
					return { kind: 'scores', result: 'no-carrier' };
				}
				return { kind: 'scores', result: 'local' };
			}
			case 'chat-send': {
				node?.send(request.text);
				// The node echoes every line back (including ours), so nothing to
				// deliver here — the broadcast arrives via the socket handler.
				return { kind: 'presence', online: machine?.online ?? [] };
			}
			case 'yell': {
				// The sysop was in the garage — answer after a believable beat.
				await settleAfter(1800, null);
				return { kind: 'yell' };
			}
		}
	}

	function uploadOutcome(
		result: api.ApiResult<{ fileId: string; held: boolean }>
	): MachineResponse {
		if (result.ok) return { kind: 'upload', result: 'ok', held: result.value.held };
		if (result.error.kind === 'refused')
			return { kind: 'upload', result: 'refused', message: result.error.message };
		if (result.error.kind === 'no-carrier') {
			void dropSession();
			return { kind: 'upload', result: 'no-carrier' };
		}
		return { kind: 'upload', result: 'local' };
	}

	/** Remember a door-game best locally too, for the phonebook artifact. */
	async function bankScore(score: number): Promise<void> {
		if (score > progress.doorHighScore) await persist({ ...progress, doorHighScore: score });
	}

	/** Open the hidden file picker and resolve with the chosen image, or null. */
	function pickImage(): Promise<Blob | null> {
		return new Promise((resolve) => {
			imagePick = resolve;
			imagePicker?.click();
			// A cancelled picker fires no event; a short guard resolves null so
			// the flow never hangs on a wait screen.
			schedule(() => {
				if (imagePick === resolve) {
					imagePick = null;
					resolve(null);
				}
			}, 60_000);
		});
	}

	function onImageChosen(event: Event): void {
		const input = event.target as HTMLInputElement;
		const file = input.files?.[0] ?? null;
		input.value = ''; // let the same file be picked again next time
		const resolve = imagePick;
		imagePick = null;
		resolve?.(file);
	}

	function submitOutcome(result: api.ApiResult<unknown>): MachineResponse {
		if (result.ok) return { kind: 'submit', result: 'ok' };
		if (result.error.kind === 'refused')
			return { kind: 'submit', result: 'refused', message: result.error.message };
		if (result.error.kind === 'no-carrier') {
			void dropSession();
			return { kind: 'submit', result: 'no-carrier' };
		}
		return { kind: 'submit', result: 'local' };
	}

	/** Map a read failure: 401 sheds the stored session, anything else is line noise. */
	async function authedFailure(error: api.ApiError): Promise<'no-carrier' | 'local'> {
		if (error.kind === 'no-carrier') {
			await dropSession();
			return 'no-carrier';
		}
		return 'local';
	}

	async function keepSession(value: Session): Promise<void> {
		session = value;
		await persist({ ...progress, handle: value.handle, session: value });
	}

	async function dropSession(): Promise<void> {
		session = null;
		await persist({ ...progress, session: null });
	}

	function onKeydown(event: KeyboardEvent): void {
		// Keys belong to this window only while it's frontmost.
		if (!lifecycle.focused) return;
		// ALT-H hangs up from anywhere in a call — checked by physical key
		// (event.code) because macOS turns Option-H into a dead character.
		if (event.altKey && event.code === 'KeyH' && view === 'call') {
			event.preventDefault();
			altHangup();
			return;
		}
		let key = event.key;
		// The phonebook and sweep screens are button-driven; ESC returns to dial.
		if (view === 'phonebook' || view === 'sweep') {
			if (key === 'Escape' && !sweepRunning) {
				event.preventDefault();
				view = 'dial';
			}
			return;
		}
		if (key === 'Escape') {
			// ESC backs up like Q on single-key screens; while a line is being
			// typed (or the modem holds the line) it stays inert — the buffer
			// belongs to the caller.
			if (
				view !== 'dial' &&
				(hayes.mode === 'command' || (machine && inputKind(machine) !== 'keys'))
			)
				return;
			key = 'q';
		}
		if (view === 'dial') {
			if (/^[0-9]$/.test(key)) {
				event.preventDefault();
				pressDigit(key);
			} else if (key === 'Backspace') {
				event.preventDefault();
				backspace();
			} else if (key === 'Enter') {
				event.preventDefault();
				dial();
			}
			return;
		}
		if (key.length !== 1 && key !== 'Enter' && key !== 'Backspace') return;
		event.preventDefault();
		// Type-ahead, like a live line: your keystroke reached the host no
		// matter what the screen was doing. A key mid-type completes the
		// screen (the PRD's merciful skip) and then still acts below, so
		// rapid navigation never drops input. On single-key screens the
		// machine binds nothing to Enter, so it stays a safe pure-skip key;
		// on line-input screens Enter submits the typed line.
		if (term.typing) term.skip();
		if (phase === 'session') {
			// Every key disarms a pending +++ guard — silence means silence.
			window.clearTimeout(guardTimer);
			if (hayes.mode === 'command') {
				applyHayes(commandKey(hayes, key, performance.now()));
				return;
			}
			const watched = watchKey(hayes, key, performance.now());
			hayes = watched.state;
			if (watched.arm) {
				guardTimer = window.setTimeout(() => applyHayes(guardElapsed(hayes)), GUARD_MS);
			}
			sessionKey(key);
		} else if (key.length !== 1) return;
		else if (phase === 'busy') {
			if (key.toLowerCase() === 'r') dial();
			else if (key.toLowerCase() === 'q') hangupToDial();
		} else if (phase === 'no-answer' || phase === 'dropped') {
			if (key.toLowerCase() === 'q' || phase === 'dropped') hangupToDial();
		}
	}

	// ── Baud-speed typing loop ──────────────────────────────────────────────

	$effect(() => {
		if (!term.typing) return;
		let raf = 0;
		let last = performance.now();
		let carry = 0;
		const loop = (now: number) => {
			carry += (charsPerSecond(baud) * (now - last)) / 1000;
			last = now;
			const emit = Math.floor(carry);
			if (emit > 0) {
				carry -= emit;
				term.tick(emit);
			}
			if (term.typing) raf = requestAnimationFrame(loop);
		};
		raf = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(raf);
	});

	/** Pins the terminal to the bottom; reading the line count and the input
	 * echo re-runs this (attachments are effects) after every printed line
	 * and every keystroke on the input line. */
	const autoscroll: Attachment<HTMLElement> = (el) => {
		if (term.lines.length === 0 && inputEcho.length === 0) return;
		el.scrollTop = el.scrollHeight;
	};

	/** Verified systems as phonebook rows (name + number). */
	function verifiedList(): { id: string; number: string; name: string }[] {
		return progress.verifiedSystems.flatMap((id) => {
			const system = systemById(id);
			return system ? [{ id, number: system.number, name: system.name }] : [];
		});
	}
</script>

<svelte:window onkeydown={onKeydown} />

<!-- The terminal palette is content, not chrome: the 16 CGA colors and the
     amber phosphor are specified by the PRD and stay hex on purpose. -->
<div class="dialer" style="--phos: {phosphor}">
	{#if view === 'dial'}
		<div class="dial-screen">
			<div class="dial-left">
				<div class="brand-plate">CROSSTALK SYSTEMS · MODEL 2400</div>
				<div class="number-display" aria-label="Number to dial">
					{number ? (number.length > 3 ? formatNumber(number) : number) : ''}<span class="cursor"
						>█</span
					>
				</div>
				<div class="keypad">
					{#each KEYPAD as [digit, letters] (digit)}
						<button class="key" onclick={() => pressDigit(digit)}>
							<span class="key-digit">{digit}</span>
							{#if letters}<span class="key-letters">{letters}</span>{/if}
						</button>
					{/each}
				</div>
				<div class="dial-actions">
					<button class="dial-btn" onclick={dial} disabled={number.length !== 7}>DIAL</button>
					<button class="clr-btn" onclick={backspace} disabled={number.length === 0}>DEL</button>
				</div>
			</div>
			<div class="dial-right">
				<div class="sticky">
					<div class="sticky-line">RUSTY DISKETTE BBS</div>
					<div class="sticky-num">555-2323</div>
					<div class="sticky-line">ask for Captain Vector</div>
				</div>
				<div class="baud">
					<div class="baud-label">BAUD</div>
					{#each BAUD_RATES as rate (rate)}
						<button class="baud-btn" class:active={baud === rate} onclick={() => chooseBaud(rate)}>
							{rate}
						</button>
					{/each}
				</div>
				<div class="tools">
					<button class="tool-btn" onclick={() => (view = 'phonebook')}>
						PHONEBOOK ({progress.verifiedSystems.length + progress.foundNumbers.length})
					</button>
					<button class="tool-btn" onclick={() => (view = 'sweep')}>AUTODIAL…</button>
				</div>
			</div>
		</div>
	{:else if view === 'phonebook'}
		<div class="pane">
			<div class="pane-title">PHONEBOOK</div>
			<div class="pane-body">
				<div class="pb-section">VERIFIED — you have connected</div>
				{#if progress.verifiedSystems.length === 0}
					<div class="pb-empty">none yet — dial the sticky note</div>
				{:else}
					{#each verifiedList() as entry (entry.id)}
						<button class="pb-row" onclick={() => dialNumber(entry.number)}>
							<span class="pb-num">{formatNumber(entry.number)}</span>
							<span class="pb-name">{entry.name}</span>
						</button>
					{/each}
				{/if}
				<div class="pb-section">UNVERIFIED — seen, not yet dialed</div>
				{#if progress.foundNumbers.length === 0}
					<div class="pb-empty">none yet — numbers you read get filed here</div>
				{:else}
					{#each progress.foundNumbers as found (found.number)}
						<button class="pb-row" onclick={() => dialNumber(found.number)}>
							<span class="pb-num">{formatNumber(found.number)}</span>
							<span class="pb-name">?UNVERIFIED? — {found.source}</span>
						</button>
					{/each}
				{/if}
				{#if progress.scanlogs.length > 0}
					<div class="pb-section">EXCHANGE SWEEPS ON FILE</div>
					{#each progress.scanlogs as log (log.block + log.date)}
						<div class="pb-empty">{log.block} — {log.date} ({log.lines.length} numbers)</div>
					{/each}
				{/if}
			</div>
			<div class="pane-actions">
				<button class="tool-btn" onclick={() => (view = 'dial')}>BACK</button>
			</div>
		</div>
	{:else if view === 'sweep'}
		<div class="pane">
			<div class="pane-title">AUTODIALER — EXCHANGE SWEEP</div>
			<div class="pane-body">
				<div class="sweep-note">
					Pick a 100-number block. One sweep a night — the phone company notices.
				</div>
				<div class="sweep-blocks">
					{#each blockPrefixes() as prefix (prefix)}
						<button
							class="block-btn"
							class:active={sweepPrefix === prefix}
							disabled={sweepRunning}
							onclick={() => (sweepPrefix = prefix)}
						>
							{blockLabel(prefix)}
						</button>
					{/each}
				</div>
				<button class="tool-btn sweep-go" disabled={sweepRunning} onclick={() => void runSweep()}>
					{sweepRunning ? 'SWEEPING…' : `SWEEP 555-${blockLabel(sweepPrefix)}xx`}
				</button>
				<div class="sweep-log">
					{#each sweepLines as sline, i (i)}
						<div class="sweep-line" class:carrier={sline.includes('CARRIER')}>{sline}</div>
					{/each}
				</div>
			</div>
			<div class="pane-actions">
				<button class="tool-btn" disabled={sweepRunning} onclick={() => (view = 'dial')}
					>BACK</button
				>
			</div>
		</div>
	{:else}
		<div class="call">
			<div class="screen" {@attach autoscroll}>
				<div class="term">
					{#each term.lines as runs, i (i)}
						<!-- Spans stay glued together: stray whitespace would shift columns. -->
						<div class="line">
							{#each runs as run, j (j)}<span class={run.fg ? `fg-${run.fg.replace('*', 'b')}` : ''}
									>{run.text}</span
								>{/each}{#if i === term.lines.length - 1}{inputEcho}<span class="cursor">█</span
								>{/if}
						</div>
					{/each}
				</div>
			</div>
			<!-- The terminal program's status line, ProComm style. -->
			<div class="status-bar">
				<span>ALT-H HANG UP</span>
				<span>{baud} N81</span>
			</div>
			{#if lastImageUrl}
				<button
					class="image-overlay"
					onclick={() => (lastImage = null)}
					aria-label="Dismiss downloaded image"
				>
					<img src={lastImageUrl} alt="Downloaded from the board" />
					<span class="image-hint">CLICK TO DISMISS</span>
				</button>
			{/if}
		</div>
	{/if}
	<input
		bind:this={imagePicker}
		class="image-input"
		type="file"
		accept="image/*"
		onchange={onImageChosen}
	/>
</div>

<style>
	.dialer {
		width: 100%;
		height: 100%;
		background: #000;
		color: var(--phos);
		/* --phos is set inline from the phosphor-tint pref; this is the fallback. */
		--phos: #ffb000;
		outline: none;
		display: flex;
		overflow: hidden;
	}

	/* ── Dial screen ─────────────────────────────────────────────────── */

	.dial-screen {
		flex: 1;
		display: flex;
		gap: 16px;
		padding: 16px;
	}

	.dial-left {
		flex: 1;
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.brand-plate {
		font-family: var(--brand-font-display);
		font-size: 8px;
		letter-spacing: 1px;
		color: var(--phos);
		opacity: 0.7;
	}

	.number-display {
		border: 2px solid var(--phos);
		font-family: var(--brand-font-body);
		font-size: 28px;
		padding: 6px 10px;
		min-height: 44px;
		letter-spacing: 4px;
	}

	.keypad {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 8px;
	}

	.key {
		background: #000;
		border: 2px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-body);
		font-size: 22px;
		padding: 8px 0 4px;
		cursor: pointer;
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 1px;
	}

	.key:hover {
		background: var(--phos);
		color: #000;
	}

	.key:active {
		background: var(--phos);
		color: #000;
	}

	.key-letters {
		font-family: var(--brand-font-display);
		font-size: 7px;
	}

	.dial-actions {
		display: flex;
		gap: 8px;
	}

	.dial-btn,
	.clr-btn {
		flex: 1;
		background: #000;
		border: 2px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-display);
		font-size: 12px;
		padding: 10px 0;
		cursor: pointer;
	}

	.dial-btn:hover:enabled,
	.clr-btn:hover:enabled {
		background: var(--phos);
		color: #000;
	}

	.dial-btn:disabled,
	.clr-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.dial-right {
		width: 190px;
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.sticky {
		background: #f7e26b;
		color: #333;
		padding: 14px 10px;
		transform: rotate(-2deg);
		box-shadow: 3px 3px 0 rgba(0, 0, 0, 0.6);
		font-family: var(--brand-font-body);
		font-size: 17px;
		text-align: center;
		line-height: 1.3;
	}

	.sticky-num {
		font-size: 24px;
		margin: 4px 0;
	}

	.baud {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.baud-label {
		font-family: var(--brand-font-display);
		font-size: 8px;
		letter-spacing: 1px;
		opacity: 0.7;
	}

	.baud-btn {
		background: #000;
		border: 2px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-body);
		font-size: 18px;
		padding: 4px 0;
		cursor: pointer;
	}

	.baud-btn:hover {
		background: var(--phos);
		color: #000;
	}

	.baud-btn.active {
		background: var(--phos);
		color: #000;
	}

	.tools {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: auto;
	}

	.tool-btn {
		background: #000;
		border: 2px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-display);
		font-size: 9px;
		letter-spacing: 1px;
		padding: 8px 6px;
		cursor: pointer;
	}

	.tool-btn:hover:enabled {
		background: var(--phos);
		color: #000;
	}

	.tool-btn:disabled {
		opacity: 0.35;
		cursor: default;
	}

	/* ── Phonebook + sweep panes ─────────────────────────────────────── */

	.pane {
		flex: 1;
		display: flex;
		flex-direction: column;
		padding: 14px;
		gap: 10px;
		overflow: hidden;
	}

	.pane-title {
		font-family: var(--brand-font-display);
		font-size: 11px;
		letter-spacing: 2px;
		border-bottom: 1px solid var(--phos);
		padding-bottom: 6px;
	}

	.pane-body {
		flex: 1;
		overflow-y: auto;
		font-family: var(--brand-font-body);
		font-size: 16px;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.pane-actions {
		display: flex;
		gap: 8px;
	}

	.pb-section {
		font-family: var(--brand-font-display);
		font-size: 8px;
		letter-spacing: 1px;
		opacity: 0.7;
		margin-top: 8px;
	}

	.pb-empty {
		opacity: 0.5;
		font-size: 14px;
	}

	.pb-row {
		display: flex;
		gap: 12px;
		background: #000;
		border: 1px solid transparent;
		color: var(--phos);
		font-family: var(--brand-font-body);
		font-size: 16px;
		text-align: left;
		padding: 3px 6px;
		cursor: pointer;
	}

	.pb-row:hover {
		border-color: var(--phos);
	}

	.pb-num {
		min-width: 88px;
	}

	.pb-name {
		opacity: 0.8;
	}

	.sweep-note {
		font-size: 14px;
		opacity: 0.8;
	}

	.sweep-blocks {
		display: grid;
		grid-template-columns: repeat(10, 1fr);
		gap: 3px;
		max-height: 160px;
		overflow-y: auto;
	}

	.block-btn {
		background: #000;
		border: 1px solid var(--phos);
		color: var(--phos);
		font-family: var(--brand-font-body);
		font-size: 13px;
		padding: 2px 0;
		cursor: pointer;
	}

	.block-btn:hover:enabled {
		background: var(--phos);
		color: #000;
	}

	.block-btn.active {
		background: var(--phos);
		color: #000;
	}

	.block-btn:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.sweep-go {
		align-self: flex-start;
	}

	.sweep-log {
		flex: 1;
		overflow-y: auto;
		font-size: 13px;
		line-height: 15px;
	}

	.sweep-line {
		white-space: pre;
	}

	.sweep-line.carrier {
		color: #5f5;
	}

	.image-input {
		display: none;
	}

	.image-overlay {
		position: absolute;
		inset: 0;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 10px;
		background: rgba(0, 0, 0, 0.9);
		border: none;
		cursor: pointer;
	}

	.image-overlay img {
		max-width: 90%;
		max-height: 80%;
		image-rendering: pixelated;
		border: 2px solid var(--phos);
	}

	.image-hint {
		font-family: var(--brand-font-display);
		font-size: 8px;
		letter-spacing: 1px;
		color: var(--phos);
		opacity: 0.7;
	}

	/* ── Terminal ────────────────────────────────────────────────────── */

	.call {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		position: relative;
	}

	.screen {
		flex: 1;
		overflow-y: auto;
		overflow-x: hidden;
		padding: 8px 12px;
	}

	.status-bar {
		display: flex;
		justify-content: space-between;
		font-family: var(--brand-font-display);
		font-size: 8px;
		letter-spacing: 1px;
		padding: 4px 12px;
		border-top: 1px solid var(--phos);
		opacity: 0.7;
	}

	.term {
		font-family: var(--brand-font-body);
		/* VT323 ships fi/fl/ff ligatures that collapse two characters into
		   one glyph cell — "fits" in the banner lost a column and skewed the
		   box. A character grid must never ligate. */
		font-variant-ligatures: none;
		font-size: 16px;
		line-height: 18px;
		color: var(--phos);
	}

	.line {
		white-space: pre-wrap;
		word-break: break-all;
		min-height: 18px;
	}

	.cursor {
		animation: blink 1060ms steps(2, jump-none) infinite;
	}

	@keyframes blink {
		0% {
			opacity: 1;
		}
		100% {
			opacity: 0;
		}
	}

	/* The 16 CGA/ANSI colors (PRD terminal spec). */
	.fg-K {
		color: #000;
	}
	.fg-R {
		color: #a00;
	}
	.fg-G {
		color: #0a0;
	}
	.fg-Y {
		color: #a50;
	}
	.fg-B {
		color: #00a;
	}
	.fg-M {
		color: #a0a;
	}
	.fg-C {
		color: #0aa;
	}
	.fg-W {
		color: #aaa;
	}
	.fg-bK {
		color: #555;
	}
	.fg-bR {
		color: #f55;
	}
	.fg-bG {
		color: #5f5;
	}
	.fg-bY {
		color: #ff5;
	}
	.fg-bB {
		color: #55f;
	}
	.fg-bM {
		color: #f5f;
	}
	.fg-bC {
		color: #5ff;
	}
	.fg-bW {
		color: #fff;
	}
</style>
