import { describe, expect, it } from 'vitest';
import {
	GUARD_MS,
	PLUS_GAP_MS,
	commandKey,
	guardElapsed,
	hayesOnline,
	watchKey,
	type HayesState
} from './hayes';

function online(state: HayesState): HayesState & { mode: 'online' } {
	if (state.mode !== 'online') throw new Error('expected online state');
	return state;
}

function command(state: HayesState): HayesState & { mode: 'command' } {
	if (state.mode !== 'command') throw new Error('expected command state');
	return state;
}

/** Type a string into command mode, one key at a time. */
function typeCommand(state: HayesState, text: string) {
	let s = state;
	for (const ch of text) s = commandKey(command(s), ch, 0).state;
	return commandKey(command(s), 'Enter', 0);
}

describe('the +++ escape', () => {
	it('arms on the third + after a quiet line', () => {
		let r = watchKey(online(hayesOnline()), '+', 5000);
		expect(r.arm).toBe(false);
		r = watchKey(online(r.state), '+', 5300);
		expect(r.arm).toBe(false);
		r = watchKey(online(r.state), '+', 5600);
		expect(r.arm).toBe(true);
	});

	it('plusses typed straight after other keys are data, not an escape', () => {
		let r = watchKey(online(hayesOnline()), 'a', 5000);
		r = watchKey(online(r.state), '+', 5200); // no guard time before the run
		r = watchKey(online(r.state), '+', 5400);
		r = watchKey(online(r.state), '+', 5600);
		expect(r.arm).toBe(false);
	});

	it('a slow + run restarts instead of arming', () => {
		let r = watchKey(online(hayesOnline()), '+', 5000);
		r = watchKey(online(r.state), '+', 5300);
		// The gap exceeds PLUS_GAP_MS (and the guard), so this + begins a new run.
		r = watchKey(online(r.state), '+', 5300 + PLUS_GAP_MS + GUARD_MS);
		expect(r.arm).toBe(false);
		expect(online(r.state).plusses).toBe(1);
	});

	it('a fourth + disarms — four plusses are data', () => {
		let r = watchKey(online(hayesOnline()), '+', 5000);
		r = watchKey(online(r.state), '+', 5300);
		r = watchKey(online(r.state), '+', 5600);
		r = watchKey(online(r.state), '+', 5800);
		expect(r.arm).toBe(false);
		expect(online(r.state).plusses).toBe(0);
	});

	it('the guard elapsing on an armed line answers OK and takes the keyboard', () => {
		let r = watchKey(online(hayesOnline()), '+', 5000);
		r = watchKey(online(r.state), '+', 5300);
		r = watchKey(online(r.state), '+', 5600);
		const out = guardElapsed(r.state);
		expect(out.state).toEqual({ mode: 'command', entry: '' });
		expect(out.prints).toEqual(['', '{W}OK{/}']);
	});

	it('the guard elapsing on an unarmed line does nothing', () => {
		const state = hayesOnline();
		expect(guardElapsed(state)).toEqual({ state, prints: [] });
	});
});

describe('command mode', () => {
	const COMMAND: HayesState = { mode: 'command', entry: '' };

	it('ATH hangs up (case-insensitive, ATH0 too)', () => {
		expect(typeCommand(COMMAND, 'ATH').action).toBe('hangup');
		expect(typeCommand(COMMAND, 'ath').action).toBe('hangup');
		expect(typeCommand(COMMAND, 'ATH0').action).toBe('hangup');
	});

	it('ATO resumes the session with a fresh guard clock', () => {
		let s: HayesState = COMMAND;
		for (const ch of 'ATO') s = commandKey(command(s), ch, 0).state;
		const resumed = commandKey(command(s), 'Enter', 9000);
		expect(resumed.action).toBe('resume');
		expect(resumed.state).toEqual({ mode: 'online', plusses: 0, lastKeyAt: 9000 });
	});

	it('bare AT answers OK and stays in command mode', () => {
		const out = typeCommand(COMMAND, 'AT');
		expect(out.action).toBeUndefined();
		expect(out.prints).toEqual(['AT', '{W}OK{/}']);
		expect(out.state).toEqual({ mode: 'command', entry: '' });
	});

	it('anything else answers ERROR', () => {
		expect(typeCommand(COMMAND, 'ATZ').prints).toEqual(['ATZ', '{W}ERROR{/}']);
		expect(typeCommand(COMMAND, 'HELLO').prints).toEqual(['HELLO', '{W}ERROR{/}']);
	});

	it('an empty Enter just echoes', () => {
		const out = commandKey(command(COMMAND), 'Enter', 0);
		expect(out).toEqual({ state: { mode: 'command', entry: '' }, prints: [''] });
	});

	it('Backspace edits the entry', () => {
		let s: HayesState = COMMAND;
		for (const ch of 'ATX') s = commandKey(command(s), ch, 0).state;
		s = commandKey(command(s), 'Backspace', 0).state;
		for (const ch of 'H') s = commandKey(command(s), ch, 0).state;
		expect(commandKey(command(s), 'Enter', 0).action).toBe('hangup');
	});
});
