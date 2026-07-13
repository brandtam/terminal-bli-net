<script lang="ts">
	import type { Attachment } from 'svelte/attachments';
	import { getAppContext } from '$lib/os/os-context';
	import type { AudioLine } from '$lib/os/audio.svelte';
	import { ModemSynth, HANDSHAKE } from './sounds';
	import { TerminalBuffer } from './terminal-buffer.svelte';
	import { charsPerSecond, BAUD_RATES, type BaudRate } from './terminal';
	import { systemByNumber, systemById } from './content';
	import type { CanonSystem } from './content/types';
	import { formatNumber } from './content/types';
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
	import type { Session } from './api';
	import {
		GUARD_MS,
		commandKey,
		guardElapsed,
		hayesOnline,
		watchKey,
		type HayesResult
	} from './hayes';
	import { loadProgress, saveProgress } from './persistence';

	const { os, fs, storage, lifecycle, turnstileSiteKey } = getAppContext();

	type View = 'dial' | 'call';
	type CallPhase = 'connecting' | 'session' | 'busy' | 'no-answer' | 'dropped';

	let view = $state<View>('dial');
	let phase = $state<CallPhase>('connecting');
	let number = $state('');
	let baud = $state<BaudRate>(storage.get<BaudRate>('baud', 2400));
	/** The line being typed on input screens, mirrored from the machine. */
	let inputEcho = $state('');
	const term = new TerminalBuffer();

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

	lifecycle.onCleanup(() => {
		clearScheduled();
		window.clearTimeout(guardTimer);
		synth?.stopAll();
		line?.close();
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

	function setBaud(b: BaudRate): void {
		baud = b;
		storage.set('baud', b);
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
				// Nobody home in this part of the exchange (canned outcomes get
				// their in-fiction variety with the hunt slice).
				const ringS = synth?.playRingback() ?? 0;
				term.print('{W}RINGING...{/}');
				schedule(() => {
					const againS = synth?.playRingback() ?? 0;
					schedule(() => {
						phase = 'no-answer';
						term.print('{R}NO ANSWER{/}');
						term.print('');
						term.print('{W}[Q] HANG UP{/}');
					}, againS * 1000);
				}, ringS * 1000);
			}
		}, 400);
	}

	function beginHandshake(): void {
		term.print('{W}CARRIER DETECTED{/}');
		term.print('{W}NEGOTIATING...{/}');
		synth?.playHandshake();
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
		applyResult(
			connect(system, { mode: check.mode, sessionHandle: check.session?.handle ?? null }),
			system
		);
	}

	/** Load stored progress and probe the trunk; expired sessions are shed here. */
	async function checkLine(system: CanonSystem): Promise<LineCheck> {
		const progress = await loadProgress(fs);
		const stored = progress.session;
		const status = await api.probeLine(system.id, stored?.token);
		if (status === 'local') return { mode: 'local', session: stored };
		if (status === 'login') {
			if (stored) await saveProgress(fs, { session: null });
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
		synth?.stopAll();
		machine = null;
		hayes = hayesOnline();
		inputEcho = '';
		term.clear();
		view = 'dial';
		phase = 'connecting';
		ensureDialTone();
	}

	/** Drop the line: carrier drop, NO CARRIER, back to the dial screen. */
	function dropCarrier(): void {
		window.clearTimeout(guardTimer);
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
		// While the modem holds the line (+++ escape), the command entry owns
		// the cursor — an async deliver() must not put the session echo back.
		if (hayes.mode !== 'command') inputEcho = entryEcho(result.state);
		if (result.hangup) {
			dropCarrier();
			return;
		}
		if (result.requests?.length) void runRequests(result.requests, system);
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
		}
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
		await saveProgress(fs, { session: value });
	}

	async function dropSession(): Promise<void> {
		session = null;
		await saveProgress(fs, { session: null });
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
</script>

<svelte:window onkeydown={onKeydown} />

<!-- The terminal palette is content, not chrome: the 16 CGA colors and the
     amber phosphor are specified by the PRD and stay hex on purpose. -->
<div class="dialer">
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
						<button class="baud-btn" class:active={baud === rate} onclick={() => setBaud(rate)}>
							{rate}
						</button>
					{/each}
				</div>
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
		</div>
	{/if}
</div>

<style>
	.dialer {
		width: 100%;
		height: 100%;
		background: #000;
		color: var(--phos);
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

	/* ── Terminal ────────────────────────────────────────────────────── */

	.call {
		flex: 1;
		display: flex;
		flex-direction: column;
		overflow: hidden;
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
