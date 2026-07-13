import { afterEach, describe, expect, it, vi } from 'vitest';

/** The barest DOM the script loader touches: a script element whose
 * onload/onerror never fire — the hung-fetch case the deadline exists for. */
function stubDom() {
	vi.stubGlobal('window', {});
	vi.stubGlobal('document', {
		createElement: () => ({ remove: vi.fn() }),
		head: { appendChild: vi.fn() }
	});
}

describe('the turnstile script deadline', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
		vi.resetModules();
	});

	it('a script that never loads rejects instead of stalling the caller', async () => {
		vi.useFakeTimers();
		stubDom();
		// Fresh module: scriptPromise is module state and must start empty.
		const { getTurnstileToken, SCRIPT_TIMEOUT_MS } = await import('./turnstile-client');
		const settled = getTurnstileToken('site-key').then(
			() => 'resolved',
			(e: Error) => e.message
		);
		await vi.advanceTimersByTimeAsync(SCRIPT_TIMEOUT_MS + 1);
		expect(await settled).toBe('Turnstile script timed out');
	});
});
