import type { FsResult } from './types';
import { ok, fail } from './errors';

const LOCK_KEY = 'terminalos.write_lock';
const LOCK_TTL_MS = 5000;

type LockData = {
	tabId: string;
	acquiredAt: number;
};

/** Generate a unique tab ID for this session. */
const TAB_ID =
	typeof crypto !== 'undefined' && crypto.randomUUID
		? crypto.randomUUID()
		: `tab-${Date.now()}-${Math.random().toString(36).slice(2)}`;

export class WriteLock {
	private tabId: string;

	constructor(tabId?: string) {
		this.tabId = tabId ?? TAB_ID;
	}

	/** Try to acquire the write lock. Returns ok if acquired, disk_busy if held by another tab. */
	acquire(): FsResult<void> {
		try {
			const raw = localStorage.getItem(LOCK_KEY);
			if (raw) {
				const lock: LockData = JSON.parse(raw);
				if (lock.tabId === this.tabId) return ok(undefined);
				if (Date.now() - lock.acquiredAt < LOCK_TTL_MS) {
					return fail('disk_busy', 'Another tab is writing to the filesystem');
				}
			}
			const lockData: LockData = { tabId: this.tabId, acquiredAt: Date.now() };
			localStorage.setItem(LOCK_KEY, JSON.stringify(lockData));
			return ok(undefined);
		} catch {
			// If localStorage is unavailable, proceed without locking
			return ok(undefined);
		}
	}

	/** Release the write lock (only if we hold it). */
	release(): void {
		try {
			const raw = localStorage.getItem(LOCK_KEY);
			if (raw) {
				const lock: LockData = JSON.parse(raw);
				if (lock.tabId === this.tabId) {
					localStorage.removeItem(LOCK_KEY);
				}
			}
		} catch {
			// Ignore errors
		}
	}

	/** Check if the lock is currently held (by any tab). */
	isLocked(): boolean {
		try {
			const raw = localStorage.getItem(LOCK_KEY);
			if (!raw) return false;
			const lock: LockData = JSON.parse(raw);
			return Date.now() - lock.acquiredAt < LOCK_TTL_MS;
		} catch {
			return false;
		}
	}
}

/**
 * In-memory lock for testing (no localStorage dependency).
 */
export class InMemoryWriteLock {
	private locked = false;
	private lockTabId: string | null = null;
	private tabId: string;

	constructor(tabId?: string) {
		this.tabId = tabId ?? 'test-tab';
	}

	acquire(): FsResult<void> {
		if (this.locked && this.lockTabId !== this.tabId) {
			return fail('disk_busy', 'Lock held by another tab');
		}
		this.locked = true;
		this.lockTabId = this.tabId;
		return ok(undefined);
	}

	release(): void {
		if (this.lockTabId === this.tabId) {
			this.locked = false;
			this.lockTabId = null;
		}
	}

	isLocked(): boolean {
		return this.locked;
	}
}
