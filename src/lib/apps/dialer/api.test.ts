import { afterEach, describe, expect, it, vi } from 'vitest';
import { REQUEST_TIMEOUT_MS, fetchTopics } from './api';

/** A fetch that never answers but honors its abort signal, like a hung
 * connection under a real browser fetch. */
function stallingFetch() {
	return vi.fn(
		(_url: string, init?: RequestInit) =>
			new Promise<Response>((_, reject) => {
				init?.signal?.addEventListener('abort', () =>
					reject(new DOMException('aborted', 'AbortError'))
				);
			})
	);
}

describe('the request deadline', () => {
	afterEach(() => {
		vi.unstubAllGlobals();
		vi.useRealTimers();
	});

	it('a stalled line settles LOCAL instead of hanging the caller', async () => {
		vi.useFakeTimers();
		vi.stubGlobal('fetch', stallingFetch());
		const pending = fetchTopics('rusty-diskette', 'tok');
		await vi.advanceTimersByTimeAsync(REQUEST_TIMEOUT_MS + 1);
		expect(await pending).toEqual({ ok: false, error: { kind: 'local' } });
	});

	it('a normal answer passes through and clears the deadline timer', async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			'fetch',
			vi.fn(async () => new Response(JSON.stringify({ topics: [] }), { status: 200 }))
		);
		expect(await fetchTopics('rusty-diskette', 'tok')).toEqual({ ok: true, value: [] });
		expect(vi.getTimerCount()).toBe(0);
	});
});
