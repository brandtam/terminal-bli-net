import { appRead, appWrite, appDelete } from '$lib/persistence';
import type { AppStorageHandle } from './os-context';

/**
 * Per-window services WindowHost assembles into AppContext. These are plain
 * factories (no Svelte machinery) so the storage namespacing and the cleanup
 * contract can be unit-tested without mounting a component.
 */

/**
 * Build the per-app key-value storage handle. Keys live in localStorage under
 * `terminal.app.<appId>.<key>` via the shared persistence helpers.
 *
 * Scoping is by convention only: every app runs in the same page and can read
 * any key it likes. This is a tidiness contract (no collisions between
 * well-behaved apps), NOT a sandbox or a security boundary.
 *
 * `getAppId` is a getter so the handle can be built before the window's
 * resolution settles (mirrors WindowHost's lazy-context pattern).
 */
export function createAppStorage(getAppId: () => string): AppStorageHandle {
	return {
		get appId() {
			return getAppId();
		},
		get namespace() {
			return `terminal.app.${getAppId()}`;
		},
		get: <T>(key: string, fallback: T): T => appRead(getAppId(), key, fallback),
		set: <T>(key: string, value: T): void => appWrite(getAppId(), key, value),
		delete: (key: string): void => appDelete(getAppId(), key)
	};
}

export type CleanupRegistry = {
	/** Register a callback to run when the window closes. */
	onCleanup(cb: () => void): void;
	/** Run all registered callbacks once, newest first. Idempotent. */
	run(): void;
};

/**
 * The OS-owned side of `lifecycle.onCleanup`. WindowHost creates one registry
 * per window and runs it from its own onDestroy, so a leaked interval or
 * oscillator is caught even when the app component forgot its own teardown.
 * Callbacks run newest-first (disposer order); one throwing callback never
 * blocks the rest. Registering after the window already closed runs the
 * callback immediately.
 */
export function createCleanupRegistry(): CleanupRegistry {
	const callbacks: (() => void)[] = [];
	let ran = false;

	const invoke = (cb: () => void) => {
		try {
			cb();
		} catch (e) {
			console.error('[terminal] window cleanup callback failed', e);
		}
	};

	return {
		onCleanup(cb: () => void): void {
			if (ran) {
				invoke(cb);
				return;
			}
			callbacks.push(cb);
		},
		run(): void {
			if (ran) return;
			ran = true;
			while (callbacks.length) invoke(callbacks.pop()!);
		}
	};
}
