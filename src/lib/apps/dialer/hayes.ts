/**
 * The Hayes command layer under the call: the +++ escape (guard time and
 * all) and the AT commands a 1987 caller would reach for. This is the
 * modem's half of the keyboard — it watches every key on its way to the
 * session, and once escaped it consumes them until ATH (hang up) or ATO
 * (back online). Pure like bbs-machine: the window owns the clock and
 * passes timestamps in, so tests drive time explicitly.
 */

/** Hayes guard time: the silence required before and after the +++
 * (register S12 defaulted to ~1 second). */
export const GUARD_MS = 1000;

/** Max gap between the three + presses; slower is just typing plusses. */
export const PLUS_GAP_MS = 1000;

/** AT commands were short; anything longer is already garbage. */
const MAX_COMMAND_CHARS = 40;

export type HayesState =
	| { mode: 'online'; plusses: number; lastKeyAt: number }
	| { mode: 'command'; entry: string };

export type HayesResult = {
	state: HayesState;
	prints: string[];
	/** hangup → drop carrier; resume → hand the keyboard back to the session. */
	action?: 'hangup' | 'resume';
};

export function hayesOnline(): HayesState {
	return { mode: 'online', plusses: 0, lastKeyAt: Number.NEGATIVE_INFINITY };
}

/**
 * Watch a key on its way to the session (the + presses reach the board too,
 * exactly like a real escape did). When `arm` is true the third + just
 * landed and the caller owes the modem GUARD_MS of silence — schedule
 * guardElapsed() and cancel it on any following key.
 */
export function watchKey(
	state: HayesState & { mode: 'online' },
	key: string,
	now: number
): { state: HayesState; arm: boolean } {
	const gap = now - state.lastKeyAt;
	let plusses = 0;
	if (key === '+') {
		if (state.plusses > 0 && state.plusses < 3 && gap <= PLUS_GAP_MS) plusses = state.plusses + 1;
		else if (gap >= GUARD_MS) plusses = 1;
	}
	return { state: { mode: 'online', plusses, lastKeyAt: now }, arm: plusses === 3 };
}

/** The post-+++ silence held: the modem answers OK and takes the keyboard. */
export function guardElapsed(state: HayesState): HayesResult {
	if (state.mode !== 'online' || state.plusses !== 3) return { state, prints: [] };
	return { state: { mode: 'command', entry: '' }, prints: ['', '{W}OK{/}'] };
}

/** A key while the modem holds the line: build the command, run it on Enter.
 * The entry itself is the echo — the window renders it at the cursor. */
export function commandKey(
	state: HayesState & { mode: 'command' },
	key: string,
	now: number
): HayesResult {
	if (key === 'Backspace') {
		return { state: { ...state, entry: state.entry.slice(0, -1) }, prints: [] };
	}
	if (key !== 'Enter') {
		if (key.length !== 1 || state.entry.length >= MAX_COMMAND_CHARS) return { state, prints: [] };
		return { state: { ...state, entry: state.entry + key }, prints: [] };
	}

	// Enter — echo the line into the scrollback like the session does, then
	// answer the way a Smartmodem would: OK, ERROR, or the action itself.
	const line = state.entry.trim().toUpperCase();
	const echo = state.entry;
	const cleared = { mode: 'command' as const, entry: '' };
	if (line === '') return { state: cleared, prints: [echo] };
	if (line === 'ATH' || line === 'ATH0') {
		return { state: cleared, prints: [echo, '{W}OK{/}'], action: 'hangup' };
	}
	if (line === 'ATO' || line === 'ATO0') {
		// Back online; the fresh timestamp means a new escape owes a full
		// guard time again.
		return {
			state: { mode: 'online', plusses: 0, lastKeyAt: now },
			prints: [echo],
			action: 'resume'
		};
	}
	if (line === 'AT') return { state: cleared, prints: [echo, '{W}OK{/}'] };
	return { state: cleared, prints: [echo, '{W}ERROR{/}'] };
}
