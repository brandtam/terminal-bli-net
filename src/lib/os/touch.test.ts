import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createLongPressMachine, isTouchLikePointer, LONG_PRESS_MS } from './touch';

describe('isTouchLikePointer', () => {
	it('treats touch and pen as touch-like', () => {
		expect(isTouchLikePointer('touch')).toBe(true);
		expect(isTouchLikePointer('pen')).toBe(true);
	});

	it('treats mouse (and unknown) as not touch-like', () => {
		expect(isTouchLikePointer('mouse')).toBe(false);
		expect(isTouchLikePointer('')).toBe(false);
	});
});

describe('createLongPressMachine', () => {
	beforeEach(() => vi.useFakeTimers());
	afterEach(() => vi.useRealTimers());

	const touchDown = (x = 100, y = 200) => ({ pointerType: 'touch', clientX: x, clientY: y });

	it('fires at the press origin after the hold delay', () => {
		const fired = vi.fn();
		const m = createLongPressMachine(fired);
		m.down(touchDown(100, 200));
		vi.advanceTimersByTime(LONG_PRESS_MS - 1);
		expect(fired).not.toHaveBeenCalled();
		vi.advanceTimersByTime(1);
		expect(fired).toHaveBeenCalledExactlyOnceWith({ clientX: 100, clientY: 200 });
	});

	it('never fires for a mouse press', () => {
		const fired = vi.fn();
		const m = createLongPressMachine(fired);
		m.down({ pointerType: 'mouse', clientX: 10, clientY: 10 });
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(fired).not.toHaveBeenCalled();
	});

	it('cancels when the finger moves past the tolerance', () => {
		const fired = vi.fn();
		const m = createLongPressMachine(fired);
		m.down(touchDown());
		m.move({ clientX: 130, clientY: 200 });
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(fired).not.toHaveBeenCalled();
	});

	it('tolerates small jitter within the tolerance', () => {
		const fired = vi.fn();
		const m = createLongPressMachine(fired);
		m.down(touchDown());
		m.move({ clientX: 104, clientY: 203 });
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(fired).toHaveBeenCalledOnce();
	});

	it('cancels on lift (pointerup) before the delay', () => {
		const fired = vi.fn();
		const m = createLongPressMachine(fired);
		m.down(touchDown());
		m.cancel();
		vi.advanceTimersByTime(LONG_PRESS_MS * 2);
		expect(fired).not.toHaveBeenCalled();
	});

	it('suppresses exactly one trailing click after firing', () => {
		const m = createLongPressMachine(vi.fn());
		m.down(touchDown());
		vi.advanceTimersByTime(LONG_PRESS_MS);
		expect(m.consumeSuppressedClick()).toBe(true);
		expect(m.consumeSuppressedClick()).toBe(false);
	});

	it('does not suppress clicks when the press never fired', () => {
		const m = createLongPressMachine(vi.fn());
		m.down(touchDown());
		m.cancel();
		expect(m.consumeSuppressedClick()).toBe(false);
	});

	it('clears a stale suppression on the next press', () => {
		const m = createLongPressMachine(vi.fn());
		m.down(touchDown());
		vi.advanceTimersByTime(LONG_PRESS_MS);
		// No click arrived (e.g. the browser ate it); a fresh tap must not be swallowed.
		m.down(touchDown());
		m.cancel();
		expect(m.consumeSuppressedClick()).toBe(false);
	});
});
