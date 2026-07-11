import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createAppStorage, createCleanupRegistry } from './app-services';

// ── App storage: the terminal.app.<appId>.<key> convention ──────────────────

function fakeLocalStorage() {
	const store = new Map<string, string>();
	return {
		store,
		getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
		setItem: (k: string, v: string) => void store.set(k, v),
		removeItem: (k: string) => void store.delete(k)
	};
}

describe('createAppStorage', () => {
	let storage: ReturnType<typeof fakeLocalStorage>;

	beforeEach(() => {
		storage = fakeLocalStorage();
		vi.stubGlobal('localStorage', storage);
	});

	afterEach(() => {
		vi.unstubAllGlobals();
	});

	it('namespaces every key as terminal.app.<appId>.<key>', () => {
		const handle = createAppStorage(() => 'demo');
		handle.set('score', 42);
		expect(storage.store.has('terminal.app.demo.score')).toBe(true);
		expect(handle.namespace).toBe('terminal.app.demo');
		expect(handle.appId).toBe('demo');
	});

	it('round-trips structured values through JSON', () => {
		const handle = createAppStorage(() => 'demo');
		handle.set('state', { level: 3, items: ['sword'] });
		expect(handle.get('state', null)).toEqual({ level: 3, items: ['sword'] });
	});

	it('returns the fallback for a missing key', () => {
		const handle = createAppStorage(() => 'demo');
		expect(handle.get('missing', 'fallback')).toBe('fallback');
	});

	it('delete removes only the named key', () => {
		const handle = createAppStorage(() => 'demo');
		handle.set('a', 1);
		handle.set('b', 2);
		handle.delete('a');
		expect(handle.get('a', null)).toBeNull();
		expect(handle.get('b', null)).toBe(2);
	});

	it('keeps two apps out of each other’s keys', () => {
		const first = createAppStorage(() => 'first');
		const second = createAppStorage(() => 'second');
		first.set('shared-name', 'from first');
		second.set('shared-name', 'from second');
		expect(first.get('shared-name', null)).toBe('from first');
		expect(second.get('shared-name', null)).toBe('from second');
	});
});

// ── Cleanup registry: the OS-owned side of lifecycle.onCleanup ──────────────

describe('createCleanupRegistry', () => {
	it('runs registered callbacks when the window closes, newest first', () => {
		const registry = createCleanupRegistry();
		const order: string[] = [];
		registry.onCleanup(() => order.push('first'));
		registry.onCleanup(() => order.push('second'));
		registry.run();
		expect(order).toEqual(['second', 'first']);
	});

	it('runs each callback exactly once even if run() is called twice', () => {
		const registry = createCleanupRegistry();
		const cb = vi.fn();
		registry.onCleanup(cb);
		registry.run();
		registry.run();
		expect(cb).toHaveBeenCalledTimes(1);
	});

	it('a throwing callback never blocks the rest', () => {
		const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
		const registry = createCleanupRegistry();
		const survivor = vi.fn();
		registry.onCleanup(survivor);
		registry.onCleanup(() => {
			throw new Error('leaked interval fought back');
		});
		registry.run();
		expect(survivor).toHaveBeenCalledTimes(1);
		expect(errorSpy).toHaveBeenCalled();
		errorSpy.mockRestore();
	});

	it('a callback registered after close runs immediately', () => {
		const registry = createCleanupRegistry();
		registry.run();
		const late = vi.fn();
		registry.onCleanup(late);
		expect(late).toHaveBeenCalledTimes(1);
	});
});
